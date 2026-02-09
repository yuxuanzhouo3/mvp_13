import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'
import { trackEvent } from '@/lib/analytics'
import { createRentPayment } from '@/lib/payment-service'

/**
 * 更新申请状态
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    let { status } = body

    const db = getDatabaseAdapter()
    const application = await db.findById('applications', params.id)

    if (!application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      )
    }

    // 获取房源信息
    const property = await db.findById('properties', application.propertyId)
    if (!property) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      )
    }

    // 房东或中介可以审核申请
    const isLandlord = property.landlordId === user.id
    let isAgent = property.agentId === user.id
    
    // 如果不是直接关联的中介，检查是否代理该房东
    if (!isLandlord && !isAgent && user.userType === 'AGENT') {
      try {
        const landlord = await db.findUserById(property.landlordId)
        if (landlord) {
          // 检查直接字段 (CloudBase)
          if (landlord.representedById === user.id) {
            isAgent = true
          } 
          // 检查 Profile (Supabase/Prisma)
          else {
            const profiles = await db.query('landlordProfiles', { userId: landlord.id })
            if (profiles && profiles.length > 0 && profiles[0].representedById === user.id) {
              isAgent = true
            }
          }

          // FIX: 如果通过关系确认是中介，但房源未绑定，自动绑定
          // 这样可以避免后续流程（如合同生成）丢失中介信息
          if (isAgent && !property.agentId) {
             console.log('Auto-binding agent to property:', user.id, property.id)
             await db.update('properties', property.id, { agentId: user.id })
             // 更新本地对象以便后续使用
             property.agentId = user.id
          }
        }
      } catch (err) {
        console.warn('Failed to check agent representation:', err)
      }
    }
    
    if (!isLandlord && !isAgent) {
      return NextResponse.json(
        { error: 'Not authorized to update this application - 无权操作此申请' },
        { status: 403 }
      )
    }

    // Agent Intervention Logic - 中介审批流介入
    let originalStatus = application.status // Save original status for rollback
    if (status === 'APPROVED' && property.agentId) {
      if (isAgent) {
        // 中介批准 -> 实际上等同于最终批准 (根据用户需求，中介批准后房东不能再操作，且需生成支付)
        // 所以这里我们依然使用 AGENT_APPROVED 作为状态名，但赋予它与 APPROVED 相同的支付生成逻辑
        status = 'AGENT_APPROVED'
      } else if (isLandlord) {
        // 房东批准 -> 必须先经过中介批准
        if (application.status !== 'AGENT_APPROVED') {
          return NextResponse.json(
            { error: 'Application must be reviewed by agent first - 申请必须先经过中介审核' },
            { status: 403 }
          )
        }
      }
    }

    const updatedApplication = await db.update('applications', params.id, {
      status: status,
      reviewedDate: new Date(),
    })

    // 加载关联数据
    const tenant = await db.findUserById(application.tenantId)
    const applicationWithRelations = {
      ...updatedApplication,
      property,
      tenant: tenant ? {
        id: tenant.id,
        name: tenant.name,
        email: tenant.email,
      } : null,
    }

    // 埋点
    await trackEvent({
      type: 'APPLICATION_SUBMIT',
      userId: application.tenantId,
      metadata: {
        applicationId: params.id,
        status,
        propertyId: application.propertyId,
      },
    })

    // 中介批准后通知房东
    if (status === 'AGENT_APPROVED') {
      const region = process.env.NEXT_PUBLIC_APP_REGION || 'global'
      const isChina = region === 'china'
      
      const notificationTitle = isChina 
        ? '申请待复审' 
        : 'Application Pending Review'
      
      const notificationMessage = isChina
        ? `中介已通过租客 ${tenant ? tenant.name : 'Unknown'} 的申请，请您最终审核。` 
        : `Agent has approved application from ${tenant ? tenant.name : 'Unknown'}. Please provide final approval.`

      try {
        await db.create('notifications', {
          userId: property.landlordId,
          type: 'APPLICATION_UPDATE',
          title: notificationTitle,
          message: notificationMessage,
          isRead: false,
          link: `/dashboard/landlord/applications/${application.id}`,
          metadata: JSON.stringify({
             applicationId: application.id,
             propertyId: property.id
          })
        })
      } catch (notifErr) {
        console.error('Failed to create notification for landlord:', notifErr)
      }
    }

    // 如果申请被批准 (APPROVED 或 AGENT_APPROVED)，创建租赁合同并提示支付
    if (status === 'APPROVED' || status === 'AGENT_APPROVED') {
      // 获取租客的tenantAgentId（如果有中介代理）
      let tenantAgentId = null
      try {
        const tenantProfiles = await db.query('tenantProfiles', { userId: tenant.id })
        if (tenantProfiles && tenantProfiles.length > 0 && tenantProfiles[0].representedById) {
          tenantAgentId = tenantProfiles[0].representedById
        }
      } catch (err) {
        console.warn('Failed to get tenant profile for agent ID:', err)
      }
      
      // 验证必要数据
      if (!property.price || property.price <= 0) {
        return NextResponse.json(
          { error: '房源价格无效，无法创建租赁合同' },
          { status: 400 }
        )
      }

      // 1. 更新房源状态为OCCUPIED（出租中）
      await db.update('properties', property.id, {
        status: 'OCCUPIED',
      })

      // 2. 更新租客状态为OCCUPIED（入住中）
      try {
        const tenantProfiles = await db.query('tenantProfiles', { userId: tenant.id })
        if (tenantProfiles && tenantProfiles.length > 0) {
          await db.update('tenantProfiles', tenantProfiles[0].id, {
            status: 'OCCUPIED'
          })
        } else {
          // 如果租客资料不存在，创建一个
          await db.create('tenantProfiles', {
            userId: tenant.id,
            status: 'OCCUPIED',
            monthlyIncome: application.monthlyIncome || null,
            creditScore: application.creditScore || null,
            employmentStatus: null,
            references: null,
            preferences: null
          })
        }
      } catch (err) {
        console.error('Failed to update tenant profile status:', err)
        // 不抛出错误，继续执行
      }

      // 3. Create Lease
      const startDate = new Date()
      const endDate = new Date()
      endDate.setFullYear(endDate.getFullYear() + 1)
      
      // 确保金额是数字类型
      const monthlyRent = Number(property.price) || 0
      const depositAmount = Number(property.deposit || application.depositAmount || property.price || 0) // 默认押金等于月租
      
      if (monthlyRent <= 0) {
        return NextResponse.json(
          { error: '房源价格无效，无法创建租赁合同' },
          { status: 400 }
        )
      }

      // Determine Listing Agent (Check Property first, then Landlord Representation)
      let listingAgentId = property.agentId || null
      if (!listingAgentId) {
        try {
          // Check if landlord has a bound agent
          const landlord = await db.findUserById(property.landlordId)
          if (landlord && landlord.representedById) {
            listingAgentId = landlord.representedById
          } else {
             // Fallback to profile check (for Supabase mainly, but good for consistency)
             const profiles = await db.query('landlordProfiles', { userId: property.landlordId })
             if (profiles && profiles.length > 0 && profiles[0].representedById) {
               listingAgentId = profiles[0].representedById
             }
          }
        } catch (err) {
          console.warn('Failed to resolve listing agent:', err)
        }
      }
      
      const leaseData: any = {
         propertyId: property.id,
         tenantId: tenant.id,
         landlordId: property.landlordId,
         listingAgentId: listingAgentId, // Updated logic
         tenantAgentId: tenantAgentId || null, // 租客代理中介
         startDate: startDate,
         endDate: endDate,
         monthlyRent: monthlyRent,
         depositAmount: depositAmount,
         status: 'PENDING_PAYMENT', // Wait for escrow payment
         isActive: false // 待支付时未激活
      }
      
      let lease
      try {
        lease = await db.create('leases', leaseData)
        console.log('Lease created successfully:', lease.id, lease)
      } catch (leaseErr: any) {
        console.error('Failed to create lease:', leaseErr)
        return NextResponse.json(
          { error: `创建租赁合同失败: ${leaseErr.message || '未知错误'}`, details: leaseErr },
          { status: 500 }
        )
      }
      
      if (!lease || !lease.id) {
        return NextResponse.json(
          { error: '创建租赁合同失败：未返回有效的合同ID' },
          { status: 500 }
        )
      }
      
      // 4. Create Rent Payment (First Month Rent + Deposit)
      // This ensures the fee calculation (Platform Fee + Agent Commission) is applied correctly.
      let paymentUrl = null
      let paymentId = null
      try {
         const paymentResult = await createRentPayment(
             tenant.id, 
             lease.id, 
             monthlyRent, 
             depositAmount,
             undefined, // use default payment method
             lease // pass lease object to optimize db calls
         )
         if (paymentResult.success && !paymentResult.error) {
             paymentUrl = paymentResult.paymentUrl
             // 优先使用返回的paymentId，如果没有则从其他字段提取
             paymentId = paymentResult.paymentId || paymentResult.paymentIntentId || paymentResult.paymentUrl?.split('orderId=')[1]
             
             console.log('Payment created successfully:', {
               paymentId,
               leaseId: lease.id,
               propertyId: property.id,
               amount: monthlyRent + depositAmount
             })
         } else {
           console.error('Payment creation failed:', paymentResult.error)
           // 支付创建失败，回滚申请状态
           // Rollback application status
           await db.update('applications', params.id, { status: originalStatus })
           // Also delete lease? Ideally yes, but lease is less critical if payment is missing.
           // Better to delete lease to avoid orphans.
           await db.delete('leases', lease.id)
           
           return NextResponse.json(
             { error: `Payment creation failed: ${paymentResult.error || 'Unknown error'} - 支付订单创建失败，请联系管理员或稍后重试` },
             { status: 500 }
           )
         }
      } catch (err: any) {
         console.error('Failed to create initial rent payment:', err)
         // Rollback
         await db.update('applications', params.id, { status: originalStatus })
         if (lease && lease.id) await db.delete('leases', lease.id)

         return NextResponse.json(
           { error: `Failed to create payment: ${err.message} - 支付创建异常` },
           { status: 500 }
         )
      }

      // 5. 根据环境变量设置通知消息（国际化）
      const region = process.env.NEXT_PUBLIC_APP_REGION || 'global'
      const isChina = region === 'china'
      
      const notificationTitle = isChina 
        ? '申请已批准' 
        : 'Application Approved'
      
      const notificationMessage = isChina
        ? `您对 ${property.title} 的申请已批准。请签署租赁合同并支付押金/租金到托管账户。`
        : `Your application for ${property.title} has been approved. Please sign the lease and pay the deposit/rent to escrow.`

      // 6. Notify Tenant to Pay (Create Notification)
      try {
        await db.create('notifications', {
          userId: tenant.id,
          type: 'SYSTEM',
          title: notificationTitle,
          message: notificationMessage,
          isRead: false,
          link: paymentUrl || `/dashboard/tenant/payments?leaseId=${lease.id}`,
          metadata: JSON.stringify({
             leaseId: lease.id,
             paymentId: paymentId,
             actionUrl: paymentUrl || `/dashboard/tenant/payments?leaseId=${lease.id}`
          })
        })
        console.log('Notification created successfully for tenant:', tenant.id)
      } catch (notifErr: any) {
        console.error('Failed to create notification:', notifErr)
        // 不抛出错误，通知创建失败不影响主流程
      }
    }

    return NextResponse.json({ application: applicationWithRelations })
  } catch (error: any) {
    console.error('Update application error:', error)
    return NextResponse.json(
      { error: 'Failed to update application', details: error.message },
      { status: 500 }
    )
  }
}

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
    const { status } = body

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
    const isAgent = property.agentId === user.id
    
    if (!isLandlord && !isAgent) {
      return NextResponse.json(
        { error: 'Not authorized to update this application' },
        { status: 403 }
      )
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

    // 如果申请被批准，创建租赁合同并提示支付
    if (status === 'APPROVED') {
      // 获取租客的tenantAgentId（如果有中介代理）
      let tenantAgentId = null
      try {
        const tenantProfile = await db.query('tenantProfiles', { userId: tenant.id })
        if (tenantProfile && tenantProfile.length > 0 && tenantProfile[0].representedById) {
          tenantAgentId = tenantProfile[0].representedById
        }
      } catch (err) {
        console.warn('Failed to get tenant profile:', err)
      }

      // 1. 更新房源状态为OCCUPIED（出租中）
      await db.update('properties', property.id, {
        status: 'OCCUPIED',
      })

      // 2. 更新租客状态为OCCUPIED（入住中）
      try {
        const tenantProfile = await db.query('tenantProfiles', { userId: tenant.id })
        if (tenantProfile && tenantProfile.length > 0) {
          await db.update('tenantProfiles', tenantProfile[0].id, {
            status: 'OCCUPIED'
          })
        } else {
          // 如果租客资料不存在，创建一个
          await db.create('tenantProfiles', {
            userId: tenant.id,
            status: 'OCCUPIED'
          })
        }
      } catch (err) {
        console.warn('Failed to update tenant profile status:', err)
      }

      // 3. Create Lease
      const leaseData = {
         propertyId: property.id,
         tenantId: tenant.id,
         landlordId: property.landlordId,
         listingAgentId: property.agentId || null, // 房源代理中介
         tenantAgentId: tenantAgentId || null, // 租客代理中介
         startDate: new Date(), // Should be from application
         endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)), // Default 1 year
         monthlyRent: property.price,
         depositAmount: property.deposit || application.depositAmount,
         status: 'PENDING_PAYMENT' // Wait for escrow payment
      }
      
      const lease = await db.create('leases', leaseData)
      
      // 4. Create Rent Payment (First Month Rent + Deposit)
      // This ensures the fee calculation (Platform Fee + Agent Commission) is applied correctly.
      let paymentUrl = null
      let paymentId = null
      try {
         const paymentResult = await createRentPayment(
             tenant.id, 
             lease.id, 
             leaseData.monthlyRent, 
             leaseData.depositAmount
         )
         if (paymentResult.success) {
             paymentUrl = paymentResult.paymentUrl
             paymentId = paymentResult.paymentIntentId || paymentResult.paymentUrl?.split('orderId=')[1]
         }
      } catch (err) {
         console.error('Failed to create initial rent payment:', err)
         // Don't fail the whole request, but log it. Tenant might need to trigger payment manually.
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
      await db.create('notifications', {
        userId: tenant.id,
        type: 'SYSTEM',
        title: notificationTitle,
        message: notificationMessage,
        isRead: false,
        link: paymentUrl || `/dashboard/tenant/payments?leaseId=${lease.id}`,
        metadata: {
           leaseId: lease.id,
           paymentId: paymentId,
           actionUrl: paymentUrl || `/dashboard/tenant/payments?leaseId=${lease.id}`
        }
      })
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

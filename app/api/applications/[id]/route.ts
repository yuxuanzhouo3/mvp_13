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
      // 1. Create Lease
      const leaseData = {
         propertyId: property.id,
         tenantId: tenant.id,
         landlordId: property.landlordId,
         listingAgentId: property.agentId, // If property has an agent
         startDate: new Date(), // Should be from application
         endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)), // Default 1 year
         monthlyRent: property.price,
         depositAmount: property.deposit,
         status: 'PENDING_PAYMENT' // Wait for escrow payment
      }
      
      const lease = await db.create('leases', leaseData)
      
      // 2. Create Rent Payment (First Month Rent + Deposit)
      // This ensures the fee calculation (Platform Fee + Agent Commission) is applied correctly.
      let paymentUrl = null
      try {
         const paymentResult = await createRentPayment(
             tenant.id, 
             lease.id, 
             leaseData.monthlyRent, 
             leaseData.depositAmount
         )
         if (paymentResult.success) {
             paymentUrl = paymentResult.paymentUrl
         }
      } catch (err) {
         console.error('Failed to create initial rent payment:', err)
         // Don't fail the whole request, but log it. Tenant might need to trigger payment manually.
      }

      // 3. Notify Tenant to Pay (Create Notification)
      await db.create('notifications', {
        userId: tenant.id,
        type: 'SYSTEM',
        title: 'Application Approved',
        message: `Your application for ${property.title} has been approved. Please sign the lease and pay the deposit/rent to escrow.`,
        isRead: false,
        metadata: {
           leaseId: lease.id,
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

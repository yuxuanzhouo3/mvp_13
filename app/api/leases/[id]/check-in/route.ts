import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'
import { releaseEscrowFunds } from '@/lib/payment-service'
import { trackEvent } from '@/lib/analytics'

/**
 * Tenant Check-in API
 * 租客确认入住
 */
export async function POST(
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

    const db = getDatabaseAdapter()
    const leaseId = params.id
    const lease = await db.findById('leases', leaseId)

    if (!lease) {
      return NextResponse.json(
        { error: 'Lease not found' },
        { status: 404 }
      )
    }

    // Verify user is the tenant
    if (lease.tenantId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized: You are not the tenant of this lease' },
        { status: 403 }
      )
    }

    // Verify lease status
    // Status should be PENDING_PAYMENT (if paid but not active?) or APPROVED?
    // Wait, createLease sets status to 'PENDING_PAYMENT'.
    // After payment, status should be updated?
    // In `return-page`, we update payment status to COMPLETED.
    // But do we update Lease status?
    // In `return-page`, there is code commented out or partial to update lease status?
    // Let's assume Lease is 'PENDING_PAYMENT' or 'SIGNED' but not 'ACTIVE'.
    
    // Actually, check-in should be available if lease is not yet active.
    if (lease.isActive) {
      return NextResponse.json(
        { error: 'Lease is already active' },
        { status: 400 }
      )
    }

    // 1. Update Lease Status to ACTIVE
    await db.update('leases', leaseId, {
      status: 'ACTIVE',
      isActive: true,
      updatedAt: new Date()
    })

    // 2. Release Escrow Funds (Trigger Split Logic)
    // Find the initial rent payment for this lease
    // Optimize: Query by userId (Tenant) first, then filter by leaseId in metadata
    // This avoids issues with querying JSON/String metadata fields directly
    const payments = await db.query('payments', { 
      userId: user.id
    })
    
    // Fallback: Filter in memory
    const rentPayment = payments.find((p: any) => {
      // Check metadata object
      if (p.metadata && typeof p.metadata === 'object') {
        return p.metadata.leaseId === leaseId
      }
      // Check metadata string
      if (p.metadata && typeof p.metadata === 'string') {
        try {
          const meta = JSON.parse(p.metadata)
          return meta.leaseId === leaseId
        } catch {
          return false
        }
      }
      return false
    })

    let fundsReleased = false
    if (rentPayment) {
      fundsReleased = await releaseEscrowFunds(rentPayment.id)
    } else {
      console.warn('No rent payment found for lease:', leaseId)
    }

    // 3. Track Event
    await trackEvent({
      type: 'LEASE_CHECK_IN',
      userId: user.id,
      metadata: {
        leaseId,
        propertyId: lease.propertyId,
        fundsReleased
      }
    })

    // 4. Notify Landlord
    try {
      const region = process.env.NEXT_PUBLIC_APP_REGION || 'global'
      const isChina = region === 'china'
      const title = isChina ? '租客已入住' : 'Tenant Checked In'
      const message = isChina 
        ? `租客已确认入住，租金已释放到您的账户（扣除平台费和中介费）。` 
        : `Tenant has checked in. Rent has been released to your account (minus fees).`
      
      await db.create('notifications', {
        userId: lease.landlordId,
        type: 'LEASE_UPDATE',
        title,
        message,
        isRead: false,
        link: `/dashboard/landlord/properties/${lease.propertyId}`,
        metadata: JSON.stringify({ leaseId, propertyId: lease.propertyId })
      })
    } catch (err) {
      console.error('Failed to notify landlord:', err)
    }

    return NextResponse.json({ 
      success: true, 
      leaseId, 
      status: 'ACTIVE',
      fundsReleased
    })

  } catch (error: any) {
    console.error('Check-in error:', error)
    return NextResponse.json(
      { error: 'Failed to process check-in', details: error.message },
      { status: 500 }
    )
  }
}

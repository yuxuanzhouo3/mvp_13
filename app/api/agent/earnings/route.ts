import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getDatabaseAdapter } from '@/lib/db-adapter'
import { prisma } from '@/lib/db'

/**
 * Get earnings for agent
 * Fetches payments where the agent is listed in the distribution details
 */
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const db = getDatabaseAdapter()

    // 1. Get all RENT payments
    // Note: Ideally we would filter by JSON field in DB, but for compatibility/MVP we filter in memory
    // or if the adapter supports JSON filtering (which our simple one might not)
    const payments = await db.query('payments', {
      type: 'RENT'
    }, {
      orderBy: { createdAt: 'desc' }
    })

    // 2. Filter for this agent
    const agentPayments = payments.filter((p: any) => {
      if (!p.distribution) return false
      const details = p.distribution.details || {}
      return details.listingAgentId === user.userId || details.tenantAgentId === user.userId
    })

    // 3. Enrich with details
    const earnings = await Promise.all(agentPayments.map(async (p: any) => {
      let propertyTitle = 'Unknown Property'
      let tenantName = 'Unknown Tenant'

      // Fetch Property
      if (p.propertyId) {
        const property = await db.findById('properties', p.propertyId)
        if (property) propertyTitle = property.title
      } else if (p.description && p.description.includes('lease')) {
         // Fallback: try to find lease then property? Too expensive.
         // Let's rely on propertyId being populated during payment creation (I should ensure that too)
      }

      // Fetch Tenant
      if (p.userId) {
        const tenant = await db.findUserById(p.userId)
        if (tenant) tenantName = tenant.name
      }

      // Calculate Agent's share
      const details = p.distribution.details || {}
      let amount = 0
      if (details.listingAgentId === user.userId) amount += (p.distribution.listingAgentFee || 0)
      if (details.tenantAgentId === user.userId) amount += (p.distribution.tenantAgentFee || 0)

      return {
        id: p.id,
        amount: amount, // The commission amount, not total rent
        totalRent: p.amount,
        description: p.description,
        status: p.escrowStatus === 'RELEASED' ? 'PAID' : (p.status === 'COMPLETED' ? 'PENDING_RELEASE' : 'PENDING'),
        createdAt: p.createdAt,
        propertyTitle,
        tenantName,
        currency: p.distribution.currency || 'USD'
      }
    }))

    // 4. Calculate stats
    const totalEarnings = earnings
      .filter(e => e.status === 'PAID')
      .reduce((sum, e) => sum + e.amount, 0)

    const thisMonth = earnings
      .filter(e => {
        const date = new Date(e.createdAt)
        const now = new Date()
        return date.getMonth() === now.getMonth() && 
               date.getFullYear() === now.getFullYear() &&
               e.status === 'PAID'
      })
      .reduce((sum, e) => sum + e.amount, 0)

    const pendingPayouts = earnings
      .filter(e => e.status === 'PENDING' || e.status === 'PENDING_RELEASE')
      .reduce((sum, e) => sum + e.amount, 0)

    // Check if agent has payout account
    let hasPayoutAccount = false
    try {
      const agentProfiles = await db.query('agentProfiles', { userId: user.userId })
      if (agentProfiles && agentProfiles.length > 0) {
        hasPayoutAccount = !!(agentProfiles[0] as any).payoutAccountId
      } else if (process.env.NEXT_PUBLIC_APP_REGION === 'china') {
         // Fallback for CloudBase: check user root if not found in collection
         const agent = await db.findUserById(user.userId)
         hasPayoutAccount = !!(agent as any)?.payoutAccountId
      }
    } catch (err) {
      console.warn('Failed to check payout account:', err)
    }

    return NextResponse.json({
      earnings,
      totalEarnings,
      thisMonth,
      pendingPayouts,
      hasPayoutAccount
    })
  } catch (error: any) {
    console.error('Get earnings error:', error)
    return NextResponse.json(
      { error: 'Failed to get earnings', details: error.message },
      { status: 500 }
    )
  }
}

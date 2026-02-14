import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase'

/**
 * Get earnings for agent
 * Fetches payments where the agent is listed in the distribution details
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request)
    const legacyUser = currentUser ? null : await getAuthUser(request)
    const user = currentUser || legacyUser
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const db = getDatabaseAdapter()
    const authHeader = request.headers.get('authorization')
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined
    const supabaseClient = createSupabaseServerClient(accessToken)
    const supabaseReaders = [supabaseClient, supabaseAdmin].filter(Boolean) as any[]
    const getField = (obj: any, keys: string[]) => {
      for (const key of keys) {
        const value = obj?.[key]
        if (value !== undefined && value !== null && value !== '') return value
      }
      return undefined
    }
    const baseUserId = (user as any).id || (user as any).userId
    let agentId = baseUserId
    if ((user as any).email) {
      try {
        const dbUser = await db.findUserByEmail((user as any).email)
        if (dbUser?.id) agentId = dbUser.id
      } catch {}
    }
    if (accessToken && supabaseClient) {
      try {
        const { data } = await supabaseClient.auth.getUser(accessToken)
        if (data?.user?.id) agentId = data.user.id
      } catch {}
    }
    if ((user as any).email && supabaseReaders.length > 0) {
      const userTables = ['User', 'user', 'users', 'profiles', 'profile', 'user_profiles', 'userProfiles']
      for (const client of supabaseReaders) {
        for (const tableName of userTables) {
          const { data, error } = await client
            .from(tableName)
            .select('id,email')
            .ilike('email', (user as any).email)
            .limit(1)
          if (!error && data && data.length > 0) {
            agentId = data[0].id
            break
          }
        }
        if (agentId && String(agentId) !== String(baseUserId)) break
      }
    }
    const agentIdSet = new Set([String(baseUserId), String(agentId)])
    const fetchTableFromSupabase = async (tableNames: string[]) => {
      if (supabaseReaders.length === 0) return []
      for (const client of supabaseReaders) {
        for (const tableName of tableNames) {
          const { data, error } = await client
            .from(tableName)
            .select('*')
          if (!error && data) return data || []
        }
      }
      return []
    }
    const parseDistribution = (value: any) => {
      if (!value) return null
      if (typeof value === 'string') {
        try {
          return JSON.parse(value)
        } catch {
          return null
        }
      }
      return value
    }

    // 1. Get all RENT payments
    // Note: Ideally we would filter by JSON field in DB, but for compatibility/MVP we filter in memory
    // or if the adapter supports JSON filtering (which our simple one might not)
    let payments: any[] = []
    let users: any[] = []
    let properties: any[] = []
    try {
      payments = await db.query('payments', {
        type: 'RENT'
      }, {
        orderBy: { createdAt: 'desc' }
      })
      users = await db.query('users', {}, { orderBy: { createdAt: 'desc' } })
      properties = await db.query('properties', {}, { orderBy: { createdAt: 'desc' } })
    } catch (error) {
      payments = await fetchTableFromSupabase(['Payment', 'payment', 'payments'])
      users = await fetchTableFromSupabase(['User', 'user', 'users', 'profiles', 'profile', 'user_profiles', 'userProfiles'])
      properties = await fetchTableFromSupabase(['Property', 'property', 'properties', 'Listing', 'listing', 'listings'])
    }
    if (payments.length > 0) {
      payments = payments.filter((p: any) => {
        const type = String(getField(p, ['type', 'paymentType', 'payment_type']) || '').toUpperCase()
        return type === 'RENT'
      })
    }

    // 2. Filter for this agent
    const agentPayments = payments.filter((p: any) => {
      const distributionValue = getField(p, ['distribution', 'distributionDetails', 'distribution_details'])
      const distribution = parseDistribution(distributionValue)
      const details = distribution?.details || distribution || {}
      const listingAgentId = String(getField(details, ['listingAgentId', 'listing_agent_id', 'agentId', 'agent_id']) || '')
      const tenantAgentId = String(getField(details, ['tenantAgentId', 'tenant_agent_id']) || '')
      if (agentIdSet.has(listingAgentId) || agentIdSet.has(tenantAgentId)) return true
      const paymentAgentId = String(getField(p, ['agentId', 'agent_id', 'listingAgentId', 'listing_agent_id', 'tenantAgentId', 'tenant_agent_id']) || '')
      return paymentAgentId ? agentIdSet.has(paymentAgentId) : false
    })
    const userMap = new Map(
      users.map((u: any) => {
        const id = String(getField(u, ['id', 'userId', 'user_id']) || '')
        return [id, u]
      })
    )
    const propertyMap = new Map(
      properties.map((p: any) => {
        const id = String(getField(p, ['id', 'propertyId', 'property_id', '_id']) || '')
        return [id, p]
      })
    )

    // 3. Enrich with details
    const earnings = await Promise.all(agentPayments.map(async (p: any) => {
      let propertyTitle = 'Unknown Property'
      let tenantName = 'Unknown Tenant'

      // Fetch Property
      const propertyId = String(getField(p, ['propertyId', 'property_id']) || '')
      if (propertyId) {
        const property = propertyMap.get(propertyId)
        if (property?.title) propertyTitle = property.title
      }

      // Fetch Tenant
      const userId = String(getField(p, ['userId', 'user_id', 'tenantId', 'tenant_id']) || '')
      if (userId) {
        const tenant = userMap.get(userId)
        if (tenant?.name) tenantName = tenant.name
      }

      // Calculate Agent's share
      const distributionValue = getField(p, ['distribution', 'distributionDetails', 'distribution_details'])
      const distribution = parseDistribution(distributionValue) || {}
      const details = distribution.details || distribution || {}
      let amount = 0
      if (agentIdSet.has(String(getField(details, ['listingAgentId', 'listing_agent_id', 'agentId', 'agent_id']) || ''))) {
        amount += Number(getField(distribution, ['listingAgentFee', 'listing_agent_fee', 'listing_fee']) || 0)
      }
      if (agentIdSet.has(String(getField(details, ['tenantAgentId', 'tenant_agent_id']) || ''))) {
        amount += Number(getField(distribution, ['tenantAgentFee', 'tenant_agent_fee', 'tenant_fee']) || 0)
      }

      return {
        id: p.id,
        amount: amount, // The commission amount, not total rent
        totalRent: getField(p, ['amount', 'totalAmount', 'total_amount', 'rentAmount', 'rent_amount']),
        description: p.description,
        status: getField(p, ['escrowStatus', 'escrow_status']) === 'RELEASED'
          ? 'PAID'
          : (getField(p, ['status', 'paymentStatus', 'payment_status']) === 'COMPLETED' ? 'PENDING_RELEASE' : 'PENDING'),
        createdAt: p.createdAt,
        propertyTitle,
        tenantName,
        currency: getField(distribution, ['currency', 'currencyCode', 'currency_code']) || 'USD'
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
      const agentProfiles = await db.query('agentProfiles', { userId: agentId })
      if (agentProfiles && agentProfiles.length > 0) {
        hasPayoutAccount = !!(agentProfiles[0] as any).payoutAccountId
      } else if (process.env.NEXT_PUBLIC_APP_REGION === 'china') {
        const agent = await db.findUserById(agentId)
        hasPayoutAccount = !!(agent as any)?.payoutAccountId
      }
    } catch (err) {
      if (supabaseReaders.length > 0) {
        const profileTables = ['agentProfiles', 'agent_profiles', 'AgentProfile', 'agentProfile']
        for (const client of supabaseReaders) {
          for (const tableName of profileTables) {
            const { data, error } = await client
              .from(tableName)
              .select('payoutAccountId,payout_account_id,userId,user_id')
              .eq('userId', agentId)
              .limit(1)
            if (!error && data && data.length > 0) {
              const row = data[0]
              hasPayoutAccount = !!(row.payoutAccountId || row.payout_account_id)
              break
            }
            const { data: dataAlt, error: errorAlt } = await client
              .from(tableName)
              .select('payoutAccountId,payout_account_id,userId,user_id')
              .eq('user_id', agentId)
              .limit(1)
            if (!errorAlt && dataAlt && dataAlt.length > 0) {
              const row = dataAlt[0]
              hasPayoutAccount = !!(row.payoutAccountId || row.payout_account_id)
              break
            }
          }
          if (hasPayoutAccount) break
        }
      }
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

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase'

/**
 * Get transactions for agent
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
    const propertyAgentFields = ['agentId', 'agent_id', 'listingAgentId', 'listing_agent_id', 'brokerId', 'broker_id']
    let leases: any[] = []
    let users: any[] = []
    let properties: any[] = []
    try {
      leases = await db.query('leases', {}, { orderBy: { createdAt: 'desc' } })
      users = await db.query('users', {}, { orderBy: { createdAt: 'desc' } })
      properties = await db.query('properties', {}, { orderBy: { createdAt: 'desc' } })
    } catch (error) {
      leases = await fetchTableFromSupabase(['Lease', 'lease', 'leases'])
      users = await fetchTableFromSupabase(['User', 'user', 'users', 'profiles', 'profile', 'user_profiles', 'userProfiles'])
      properties = await fetchTableFromSupabase(['Property', 'property', 'properties', 'Listing', 'listing', 'listings'])
    }
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
    const normalizeLease = (lease: any) => ({
      ...lease,
      id: lease.id ?? lease._id ?? lease.leaseId ?? lease.lease_id,
      tenantId: lease.tenantId ?? lease.tenant_id,
      landlordId: lease.landlordId ?? lease.landlord_id,
      propertyId: lease.propertyId ?? lease.property_id,
      listingAgentId: lease.listingAgentId ?? lease.listing_agent_id,
      tenantAgentId: lease.tenantAgentId ?? lease.tenant_agent_id,
      createdAt: lease.createdAt ?? lease.created_at
    })
    const filteredLeases = leases.map(normalizeLease).filter((lease: any) => {
      const listingAgentId = String(getField(lease, ['listingAgentId', 'listing_agent_id']) || '')
      const tenantAgentId = String(getField(lease, ['tenantAgentId', 'tenant_agent_id']) || '')
      const agentIdValue = String(getField(lease, ['agentId', 'agent_id']) || '')
      if (agentIdSet.has(listingAgentId) || agentIdSet.has(tenantAgentId) || agentIdSet.has(agentIdValue)) return true
      const propertyId = String(getField(lease, ['propertyId', 'property_id']) || '')
      const property = propertyMap.get(propertyId)
      const propertyAgentId = String(getField(property, propertyAgentFields) || '')
      return propertyAgentId ? agentIdSet.has(propertyAgentId) : true
    })
    const transactions = filteredLeases.map((lease: any) => {
      const propertyId = String(getField(lease, ['propertyId', 'property_id']) || '')
      const tenantId = String(getField(lease, ['tenantId', 'tenant_id']) || '')
      const landlordId = String(getField(lease, ['landlordId', 'landlord_id']) || '')
      const property = propertyMap.get(propertyId)
      const tenant = userMap.get(tenantId)
      const landlord = userMap.get(landlordId)
      return {
        id: lease.id,
        property: property ? {
          id: getField(property, ['id', 'propertyId', 'property_id', '_id']),
          title: property.title,
          address: property.address
        } : null,
        tenant: tenant ? {
          name: tenant.name,
          email: tenant.email
        } : null,
        landlord: landlord ? {
          name: landlord.name,
          email: landlord.email
        } : null,
        amount: lease.monthlyRent ?? lease.monthly_rent ?? lease.amount,
        status: lease.status,
        createdAt: lease.createdAt
      }
    })

    return NextResponse.json({ transactions })
  } catch (error: any) {
    console.error('Get transactions error:', error)
    return NextResponse.json(
      { error: 'Failed to get transactions', details: error.message },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter, getAppRegion } from '@/lib/db-adapter'
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const timeoutMarker = Symbol('tenant-leases-timeout')
    const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T | typeof timeoutMarker> => {
      return await Promise.race([
        promise,
        new Promise<typeof timeoutMarker>((resolve) => setTimeout(() => resolve(timeoutMarker), timeoutMs))
      ])
    }
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const region = getAppRegion()
    const authHeader = request.headers.get('authorization')
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined
    const supabaseClient = createSupabaseServerClient(accessToken)
    const supabaseReaders = [supabaseAdmin, supabaseClient].filter(Boolean) as any[]
    let tokenUserId: string | null = null
    if (accessToken && supabaseClient) {
      try {
        const tokenResult = await withTimeout(supabaseClient.auth.getUser(accessToken), 2500)
        if (tokenResult !== timeoutMarker && (tokenResult as any)?.data?.user?.id) tokenUserId = String((tokenResult as any).data.user.id)
      } catch {}
    }
    if (!tokenUserId && accessToken && supabaseAdmin) {
      try {
        const tokenResult = await withTimeout(supabaseAdmin.auth.getUser(accessToken), 2500)
        if (tokenResult !== timeoutMarker && (tokenResult as any)?.data?.user?.id) tokenUserId = String((tokenResult as any).data.user.id)
      } catch {}
    }
    const db = getDatabaseAdapter()
    let resolvedUserId = user.id
    try {
      const byIdResult = await withTimeout(db.findUserById(user.id), 1200)
      const byIdUser = byIdResult === timeoutMarker ? null : byIdResult
      let byEmailUser: any = null
      if (!byIdUser && user.email) {
        const byEmailResult = await withTimeout(db.findUserByEmail(user.email), 1200)
        byEmailUser = byEmailResult === timeoutMarker ? null : byEmailResult
      }
      const dbUser = byIdUser || byEmailUser
      if (dbUser?.id) resolvedUserId = dbUser.id
    } catch {}
    if (tokenUserId) resolvedUserId = tokenUserId
    const tenantIdSet = new Set([String(user.id), String(resolvedUserId), ...(tokenUserId ? [String(tokenUserId)] : [])])
    const fetchLeasesFromSupabase = async () => {
      if (supabaseReaders.length === 0) return []
      const tables = ['Lease', 'lease', 'leases']
      const tenantFields = ['tenantId', 'tenant_id']
      const tenantEmailFields = ['tenantEmail', 'tenant_email', 'userEmail', 'user_email']
      for (const client of supabaseReaders) {
        for (const tableName of tables) {
          for (const field of tenantFields) {
            const { data, error } = await client
              .from(tableName)
              .select('*')
              .in(field, Array.from(tenantIdSet))
            if (!error && data?.length) return data
          }
          if (user.email) {
            for (const field of tenantEmailFields) {
              const { data, error } = await client
                .from(tableName)
                .select('*')
                .ilike(field, user.email)
              if (!error && data?.length) return data
            }
          }
        }
      }
      for (const client of supabaseReaders) {
        for (const tableName of tables) {
          const { data, error } = await client.from(tableName).select('*')
          if (!error && data) {
            const filtered = data.filter((row: any) => {
              const tid = row.tenantId ?? row.tenant_id
              const email = row.tenantEmail ?? row.tenant_email ?? row.userEmail ?? row.user_email
              if (tid && tenantIdSet.has(String(tid))) return true
              if (user.email && email && String(email).toLowerCase() === String(user.email).toLowerCase()) return true
              return false
            })
            if (filtered.length > 0) return filtered
          }
        }
      }
      return []
    }
    const fetchPropertyFromSupabase = async (propertyId: string) => {
      if (!propertyId || supabaseReaders.length === 0) return null
      const tables = ['Property', 'property', 'properties']
      const idFields = ['id', 'propertyId', 'property_id', '_id']
      for (const client of supabaseReaders) {
        for (const tableName of tables) {
          for (const field of idFields) {
            const { data, error } = await client
              .from(tableName)
              .select('*')
              .eq(field, propertyId)
              .limit(1)
            if (!error && data && data.length > 0) return data[0]
          }
        }
      }
      return null
    }
    const fetchUserFromSupabase = async (userId: string) => {
      if (!userId || supabaseReaders.length === 0) return null
      const tables = ['User', 'user', 'users']
      for (const client of supabaseReaders) {
        for (const tableName of tables) {
          const { data, error } = await client
            .from(tableName)
            .select('id,name,email,phone,avatar')
            .eq('id', userId)
            .limit(1)
          if (!error && data && data.length > 0) return data[0]
        }
      }
      return null
    }
    let leases = []

    if (region === 'global') {
      const [byTenantResult, byTenantSnakeResult] = await Promise.all([
        withTimeout(db.query('leases', { tenantId: Array.from(tenantIdSet).length === 1 ? Array.from(tenantIdSet)[0] : { in: Array.from(tenantIdSet) } }), 3000),
        withTimeout(db.query('leases', { tenant_id: Array.from(tenantIdSet).length === 1 ? Array.from(tenantIdSet)[0] : { in: Array.from(tenantIdSet) } }), 3000)
      ])
      const byTenant = byTenantResult === timeoutMarker ? [] : (Array.isArray(byTenantResult) ? byTenantResult : [])
      const byTenantSnake = byTenantSnakeResult === timeoutMarker ? [] : (Array.isArray(byTenantSnakeResult) ? byTenantSnakeResult : [])
      const map = new Map<string, any>()
      ;[...byTenant, ...byTenantSnake].forEach((lease: any) => {
        const key = String(lease.id || lease._id || lease.leaseId || lease.lease_id || `${lease.tenantId || lease.tenant_id}_${lease.propertyId || lease.property_id}`)
        if (!map.has(key)) map.set(key, lease)
      })
      const rawLeases = Array.from(map.values())
      leases = await Promise.all(rawLeases.map(async (lease: any) => {
        const propertyId = String(lease.propertyId || lease.property_id || '').trim()
        const listingAgentId = String(lease.listingAgentId || lease.listing_agent_id || '').trim()
        const [propertyResult, agentResult] = await Promise.all([
          propertyId ? withTimeout(db.findById('properties', propertyId), 1200) : Promise.resolve(null),
          listingAgentId ? withTimeout(db.findUserById(listingAgentId), 1200) : Promise.resolve(null)
        ])
        const property = propertyResult === timeoutMarker ? null : propertyResult
        const listingAgent = agentResult === timeoutMarker ? null : agentResult
        return {
          ...lease,
          id: lease.id ?? lease._id ?? lease.leaseId ?? lease.lease_id,
          tenantId: lease.tenantId ?? lease.tenant_id,
          propertyId: lease.propertyId ?? lease.property_id,
          listingAgentId: lease.listingAgentId ?? lease.listing_agent_id,
          createdAt: lease.createdAt ?? lease.created_at,
          property: property ? {
            id: property.id,
            title: property.title,
            address: property.address,
            city: property.city,
            state: property.state,
            images: property.images
          } : null,
          listingAgent: listingAgent ? {
            id: listingAgent.id,
            name: listingAgent.name,
            email: listingAgent.email,
            phone: listingAgent.phone
          } : null
        }
      }))
    } else {
      // 获取所有租赁记录，然后过滤（因为CloudBase可能不支持复杂查询）
      let allLeases = await db.query('leases', {})
      // 过滤出该租客的租赁记录
      const targetTenantId = String(resolvedUserId).trim()
      leases = allLeases.filter((l: any) => {
        const tid = String(l.tenantId || l.tenant_id || '').trim()
        if (tid && (tid === targetTenantId || tid === String(user.id).trim())) return true
        // Try fuzzy match or email match if available
        if (user.email && (l.tenantEmail === user.email || l.tenant_email === user.email)) return true
        return false
      })
      
      // Enrich with property data
      leases = await Promise.all(leases.map(async (lease: any) => {
        const property = await db.findById('properties', lease.propertyId)
        let listingAgent = null
        if (lease.listingAgentId) {
             listingAgent = await db.findUserById(lease.listingAgentId)
        }
        return {
          ...lease,
          property: property ? {
            id: property.id,
            title: property.title,
            address: property.address,
            city: property.city,
            state: property.state,
            images: property.images
          } : null,
          listingAgent: listingAgent ? {
             id: listingAgent.id,
             name: listingAgent.name,
             email: listingAgent.email,
             phone: listingAgent.phone
          } : null
        }
      }))
    }

    return NextResponse.json({ leases })
  } catch (error: any) {
    console.error('Get leases error:', error)
    return NextResponse.json({ error: 'Failed to get leases', details: error.message }, { status: 500 })
  }
}

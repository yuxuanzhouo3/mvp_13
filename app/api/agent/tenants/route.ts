import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase'

/**
 * Get all tenants (for agents to help find homes)
 * 使用数据库适配器，自动根据环境变量选择数据源
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
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
    const getRepId = (obj: any) => {
      return (
        getField(obj, ['representedById', 'represented_by_id', 'tenant_representedById', 'tenant_represented_by_id', 'landlord_representedById', 'landlord_represented_by_id']) ??
        getField(obj?.tenantProfile, ['representedById', 'represented_by_id']) ??
        getField(obj?.landlordProfile, ['representedById', 'represented_by_id'])
      )
    }
    const getUserType = (obj: any) =>
      String(getField(obj, ['userType', 'user_type', 'type', 'role']) || '').toUpperCase()
    const propertyAgentFields = ['agentId', 'agent_id', 'listingAgentId', 'listing_agent_id', 'brokerId', 'broker_id']
    const propertyLandlordFields = ['landlordId', 'landlord_id', 'ownerId', 'owner_id', 'userId', 'user_id']
    let agentId = user.id
    if (user.email) {
      try {
        const dbUser = await db.findUserByEmail(user.email)
        if (dbUser?.id) agentId = dbUser.id
      } catch (e) {
        agentId = user.id
      }
    }
    if (accessToken && supabaseClient) {
      try {
        const { data } = await supabaseClient.auth.getUser(accessToken)
        if (data?.user?.id) agentId = data.user.id
      } catch {}
    }
    if (user.email && supabaseReaders.length > 0) {
      const userTables = ['User', 'user', 'users', 'profiles', 'profile', 'user_profiles', 'userProfiles']
      for (const client of supabaseReaders) {
        for (const tableName of userTables) {
          const { data, error } = await client
            .from(tableName)
            .select('id,email')
            .ilike('email', user.email)
            .limit(1)
          if (!error && data && data.length > 0) {
            agentId = data[0].id
            break
          }
        }
        if (agentId && String(agentId) !== String(user.id)) break
      }
    }
    const agentIdSet = new Set([String(user.id), String(agentId)])

    const fetchProfileMap = async (tableNames: string[]) => {
      const profileMap = new Map<string, any>()
      if (supabaseReaders.length === 0) return profileMap
      for (const client of supabaseReaders) {
        for (const tableName of tableNames) {
          const { data, error } = await client
            .from(tableName)
            .select('*')
          if (!error && data) {
            data.forEach((row: any) => {
              const uid = row.userId ?? row.user_id
              if (uid) profileMap.set(String(uid), row)
            })
            if (profileMap.size > 0) return profileMap
          }
        }
      }
      return profileMap
    }
    const fetchUsersFromSupabase = async () => {
      if (supabaseReaders.length === 0) return []
      const userTables = ['User', 'user', 'users', 'profiles', 'profile', 'user_profiles', 'userProfiles']
      const landlordProfiles = ['landlordProfiles', 'landlord_profiles', 'LandlordProfile', 'landlordProfile']
      const tenantProfiles = ['tenantProfiles', 'tenant_profiles', 'TenantProfile', 'tenantProfile']
      const landlordProfileMap = await fetchProfileMap(landlordProfiles)
      const tenantProfileMap = await fetchProfileMap(tenantProfiles)
      for (const client of supabaseReaders) {
        for (const tableName of userTables) {
          const { data, error } = await client
            .from(tableName)
            .select('*')
          if (!error && data) {
            return (data || []).map((row: any) => ({
              ...row,
              landlordProfile: landlordProfileMap.get(String(row.id)),
              tenantProfile: tenantProfileMap.get(String(row.id)),
            }))
          }
        }
      }
      return []
    }
    const fetchPropertiesFromSupabase = async () => {
      if (supabaseReaders.length === 0) return []
      const propertyTables = ['Property', 'property', 'properties', 'Listing', 'listing', 'listings']
      for (const client of supabaseReaders) {
        for (const tableName of propertyTables) {
          const { data, error } = await client
            .from(tableName)
            .select('*')
          if (!error && data) return data || []
        }
      }
      return []
    }
    const fetchApplicationsFromSupabase = async () => {
      if (supabaseReaders.length === 0) return []
      const applicationTables = ['Application', 'application', 'applications']
      for (const client of supabaseReaders) {
        for (const tableName of applicationTables) {
          const { data, error } = await client
            .from(tableName)
            .select('*')
          if (!error && data) return data || []
        }
      }
      return []
    }

    let allUsers: any[] = []
    let allProperties: any[] = []
    let allApplications: any[] = []
    try {
      allUsers = await db.query('users', {}, {
        orderBy: { createdAt: 'desc' }
      })
      allProperties = await db.query('properties', {}, { orderBy: { createdAt: 'desc' } })
      allApplications = await db.query('applications', {}, { orderBy: { createdAt: 'desc' } })
    } catch (error) {
      allUsers = await fetchUsersFromSupabase()
      allProperties = await fetchPropertiesFromSupabase()
      allApplications = await fetchApplicationsFromSupabase()
    }
    const representedLandlordIds = new Set(
      allUsers
        .filter((u: any) => {
          const type = getUserType(u)
          if (type !== 'LANDLORD') return false
          const repId = getRepId(u)
          return agentIdSet.has(String(repId || ''))
        })
        .map((u: any) => String(getField(u, ['id', 'userId', 'user_id']) || ''))
        .filter(Boolean)
    )
    const agentPropertyIds = new Set(
      allProperties
        .filter((p: any) => {
          const pid = String(getField(p, propertyAgentFields) || '')
          const lid = String(getField(p, propertyLandlordFields) || '')
          return agentIdSet.has(pid) || (lid && representedLandlordIds.has(lid))
        })
        .map((p: any) => String(getField(p, ['id', '_id', 'propertyId', 'property_id']) || ''))
        .filter(Boolean)
    )
    const relatedTenantIds = new Set(
      allApplications
        .filter((app: any) => {
          const pid = String(getField(app, ['propertyId', 'property_id']) || '')
          return pid && agentPropertyIds.has(pid)
        })
        .map((app: any) => String(getField(app, ['tenantId', 'tenant_id']) || ''))
        .filter(Boolean)
    )
    
    // 无论是国内版还是国际版，都只返回该中介代理的租客
    const tenants = allUsers.filter((t: any) => {
      const type = getUserType(t)
      if (type !== 'TENANT') return false
      const repId = getRepId(t)
      const id = String(getField(t, ['id', 'userId', 'user_id']) || '')
      return agentIdSet.has(String(repId || '')) || (id && relatedTenantIds.has(id))
    })

    console.log(`Found ${tenants.length} tenants for agent ${agentId}`)

    // 格式化响应（CloudBase 可能没有 tenantProfile，需要单独处理）
    const formattedTenants = tenants.map((tenant: any) => ({
      id: tenant.id,
      name: tenant.name,
      email: tenant.email,
      phone: tenant.phone,
      createdAt: tenant.createdAt,
      tenantProfile: {
        monthlyIncome: null,
        creditScore: null,
        employmentStatus: null
      }
    }))

    return NextResponse.json({ tenants: formattedTenants })
  } catch (error: any) {
    console.error('Get tenants error:', error)
    return NextResponse.json(
      { error: 'Failed to get tenants', details: error.message },
      { status: 500 }
    )
  }
}

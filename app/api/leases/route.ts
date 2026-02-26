import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * 获取租约列表
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
    let dbUser = null
    try {
      dbUser = await db.findUserById(user.id)
    } catch {}
    if (!dbUser && user.email) {
      try {
        dbUser = await db.findUserByEmail(user.email)
      } catch {}
    }
    const resolvedUserId = dbUser?.id || user.id
    let tokenUserId: string | null = null
    const authHeader = request.headers.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ') && supabaseAdmin) {
      const token = authHeader.substring(7)
      try {
        const { data } = await supabaseAdmin.auth.getUser(token)
        if (data?.user?.id) {
          tokenUserId = String(data.user.id)
        }
      } catch {}
    }

    const fetchLeasesFromSupabase = async () => {
      if (!supabaseAdmin) return []
      const tableNames = ['Lease', 'lease', 'leases']
      for (const tableName of tableNames) {
        const { data, error } = await supabaseAdmin
          .from(tableName)
          .select('*')
        if (!error && data) return data || []
      }
      return []
    }
    const fetchPropertiesFromSupabase = async () => {
      if (!supabaseAdmin) return []
      const tableNames = ['Property', 'property', 'properties', 'Listing', 'listing', 'listings']
      for (const tableName of tableNames) {
        const { data, error } = await supabaseAdmin
          .from(tableName)
          .select('*')
        if (!error && data) return data || []
      }
      return []
    }
    const fetchUsersFromSupabase = async () => {
      if (!supabaseAdmin) return []
      const tableNames = ['User', 'user', 'users', 'Profile', 'profile', 'profiles']
      for (const tableName of tableNames) {
        const { data, error } = await supabaseAdmin
          .from(tableName)
          .select('*')
        if (!error && data) return data || []
      }
      return []
    }
    const normalizeLease = (lease: any) => ({
      ...lease,
      id: lease.id ?? lease._id ?? lease.leaseId ?? lease.lease_id,
      tenantId: lease.tenantId ?? lease.tenant_id,
      landlordId: lease.landlordId ?? lease.landlord_id,
      propertyId: lease.propertyId ?? lease.property_id,
      listingAgentId: lease.listingAgentId ?? lease.listing_agent_id,
      tenantAgentId: lease.tenantAgentId ?? lease.tenant_agent_id,
      startDate: lease.startDate ?? lease.start_date,
      createdAt: lease.createdAt ?? lease.created_at
    })

    let leases: any[] = []
    let usedSupabaseFallback = false
    try {
      leases = await db.query('leases', {})
    } catch {
      leases = await fetchLeasesFromSupabase()
      usedSupabaseFallback = leases.length > 0
    }
    if (leases.length === 0 && supabaseAdmin) {
      leases = await fetchLeasesFromSupabase()
      usedSupabaseFallback = leases.length > 0
    }
    leases = leases.map(normalizeLease)
    
    if (dbUser?.userType === 'TENANT') {
      leases = leases.filter((l: any) => String(l.tenantId || '') === String(resolvedUserId))
    } else if (dbUser?.userType === 'LANDLORD') {
      const landlordIdSet = new Set([String(resolvedUserId), String(user.id)])
      if (tokenUserId) landlordIdSet.add(String(tokenUserId))
      let properties: any[] = []
      try {
        properties = await db.query('properties', {})
      } catch {
        properties = await fetchPropertiesFromSupabase()
      }
      if (properties.length === 0 && supabaseAdmin) {
        properties = await fetchPropertiesFromSupabase()
      }
      const propertyIds = new Set(
        properties
          .filter((p: any) => landlordIdSet.has(String((p as any).landlordId ?? (p as any).landlord_id ?? '')))
          .map((p: any) => p.id || p._id)
          .filter(Boolean)
      )
      leases = leases.filter((l: any) => l.propertyId && propertyIds.has(l.propertyId))
    }

    // 排序
    leases.sort((a: any, b: any) => {
      const dateA = new Date(a.startDate || a.createdAt).getTime()
      const dateB = new Date(b.startDate || b.createdAt).getTime()
      return dateB - dateA
    })

    // 加载关联数据
    let cachedProperties: any[] | null = null
    let cachedUsers: any[] | null = null
    const getPropertyFromCache = async (propertyId: string) => {
      if (!propertyId) return null
      if (!usedSupabaseFallback) return null
      if (!cachedProperties) {
        cachedProperties = await fetchPropertiesFromSupabase()
      }
      return cachedProperties.find((p: any) => String(p.id || p._id || p.propertyId || p.property_id || '') === propertyId) || null
    }
    const getUserFromCache = async (userId: string) => {
      if (!userId) return null
      if (!usedSupabaseFallback) return null
      if (!cachedUsers) {
        cachedUsers = await fetchUsersFromSupabase()
      }
      return cachedUsers.find((u: any) => String(u.id || u.userId || u.user_id || '') === userId) || null
    }

    const leasesWithRelations = await Promise.all(
      leases.map(async (lease: any) => {
        let property = null
        let tenant = null
        let landlord = null
        
        try {
          if (lease.propertyId) {
            property = await db.findById('properties', lease.propertyId)
            if (property && property.landlordId) {
              landlord = await db.findUserById(property.landlordId)
            }
          }
        } catch (err) {
          property = await getPropertyFromCache(String(lease.propertyId || ''))
        }
        
        try {
          if (lease.tenantId) {
            tenant = await db.findUserById(lease.tenantId)
          }
        } catch (err) {
          tenant = await getUserFromCache(String(lease.tenantId || ''))
        }

        if (!landlord && property?.landlordId) {
          landlord = await getUserFromCache(String(property.landlordId))
        }
        
        return {
          ...lease,
          property: property ? {
            id: property.id,
            title: property.title,
            address: property.address,
          } : null,
          tenant: tenant ? {
            id: tenant.id,
            name: tenant.name,
            email: tenant.email,
          } : null,
          landlord: landlord ? {
            id: landlord.id,
            name: landlord.name,
            email: landlord.email,
          } : null,
        }
      })
    )

    return NextResponse.json({ leases: leasesWithRelations })
  } catch (error: any) {
    console.error('Get leases error:', error)
    return NextResponse.json(
      { error: 'Failed to get leases', details: error.message },
      { status: 500 }
    )
  }
}

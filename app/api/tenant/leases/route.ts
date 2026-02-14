import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { prisma } from '@/lib/db'
import { getDatabaseAdapter, getAppRegion } from '@/lib/db-adapter'
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const region = getAppRegion()
    const authHeader = request.headers.get('authorization')
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined
    const supabaseClient = createSupabaseServerClient(accessToken)
    const supabaseReaders = [supabaseClient, supabaseAdmin].filter(Boolean) as any[]
    let tokenUserId: string | null = null
    if (accessToken && supabaseClient) {
      try {
        const { data } = await supabaseClient.auth.getUser(accessToken)
        if (data?.user?.id) tokenUserId = String(data.user.id)
      } catch {}
    }
    if (!tokenUserId && accessToken && supabaseAdmin) {
      try {
        const { data } = await supabaseAdmin.auth.getUser(accessToken)
        if (data?.user?.id) tokenUserId = String(data.user.id)
      } catch {}
    }
    const db = getDatabaseAdapter()
    let resolvedUserId = user.id
    try {
      const dbUser = (await db.findUserById(user.id)) || (user.email ? await db.findUserByEmail(user.email) : null)
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
      try {
        leases = await prisma.lease.findMany({
          where: { tenantId: user.id },
          include: {
            property: {
              select: {
                id: true,
                title: true,
                address: true,
                city: true,
                state: true,
                images: true
              }
            },
            listingAgent: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        })
      } catch (error) {
        if (supabaseReaders.length === 0) {
          throw error
        }
        const rawLeases = await fetchLeasesFromSupabase()
        const propertyCache = new Map<string, any>()
        const userCache = new Map<string, any>()
        const getProperty = async (propertyId: string) => {
          if (!propertyId) return null
          if (propertyCache.has(propertyId)) return propertyCache.get(propertyId)
          const prop = await fetchPropertyFromSupabase(propertyId)
          propertyCache.set(propertyId, prop)
          return prop
        }
        const getUser = async (userId: string) => {
          if (!userId) return null
          if (userCache.has(userId)) return userCache.get(userId)
          const u = await fetchUserFromSupabase(userId)
          userCache.set(userId, u)
          return u
        }
        const normalizeLease = (lease: any) => ({
          ...lease,
          id: lease.id ?? lease._id ?? lease.leaseId ?? lease.lease_id,
          tenantId: lease.tenantId ?? lease.tenant_id,
          propertyId: lease.propertyId ?? lease.property_id,
          listingAgentId: lease.listingAgentId ?? lease.listing_agent_id,
          createdAt: lease.createdAt ?? lease.created_at
        })
        const filtered = rawLeases
          .map(normalizeLease)
          .filter((l: any) => tenantIdSet.has(String(l.tenantId || '')))
          .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        leases = await Promise.all(filtered.map(async (lease: any) => {
          const propertyId = String(lease.propertyId || '').trim()
          const listingAgentId = String(lease.listingAgentId || '').trim()
          const property = propertyId ? await getProperty(propertyId) : null
          const listingAgent = listingAgentId ? await getUser(listingAgentId) : null
          const images = Array.isArray(property?.images)
            ? property.images
            : (typeof property?.images === 'string' ? JSON.parse(property.images) : [])
          return {
            ...lease,
            property: property ? {
              id: property.id || property._id || property.propertyId || property.property_id,
              title: property.title,
              address: property.address,
              city: property.city,
              state: property.state,
              images
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
    } else {
      // 获取所有租赁记录，然后过滤（因为CloudBase可能不支持复杂查询）
      let allLeases = await db.query('leases', {})
      // 过滤出该租客的租赁记录
      leases = allLeases.filter((l: any) => l.tenantId === user.id)
      
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

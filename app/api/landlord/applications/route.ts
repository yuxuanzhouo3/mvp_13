import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getAuthUser } from '@/lib/auth'
import { getAppRegion, getDatabaseAdapter } from '@/lib/db-adapter'
import { prisma } from '@/lib/db'
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    let user = await getCurrentUser(request)
    if (!user) {
      const legacyAuth = await getAuthUser(request)
      if (legacyAuth) {
        const db = getDatabaseAdapter()
        const dbUser = (await db.findUserById(legacyAuth.userId).catch(() => null)) ||
          (legacyAuth.email ? await db.findUserByEmail(legacyAuth.email).catch(() => null) : null)
        if (dbUser) {
          user = {
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.name,
            userType: dbUser.userType,
            isPremium: dbUser.isPremium ?? false,
            vipLevel: dbUser.vipLevel ?? 'FREE',
          }
        } else {
          user = {
            id: legacyAuth.userId,
            email: legacyAuth.email || '',
            name: legacyAuth.email?.split('@')[0] || '',
            userType: (legacyAuth as any).userType || 'TENANT',
            isPremium: false,
            vipLevel: 'FREE',
          }
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const region = getAppRegion()
    const db = getDatabaseAdapter()
    let resolvedUserId = user.id

    // Attempt to resolve user ID from DB
    try {
      const userById = await db.findUserById(user.id)
      const userByEmail = !userById && user.email ? await db.findUserByEmail(user.email) : null
      const resolvedUser = userById || userByEmail
      if (resolvedUser?.id) {
        resolvedUserId = resolvedUser.id
      }
    } catch {}

    let tokenUserId: string | null = null
    const authHeader = request.headers.get('authorization')
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined
    const supabaseClient = createSupabaseServerClient(accessToken)
    const supabaseReaders = [supabaseAdmin, supabaseClient].filter(Boolean) as any[]

    // Get Supabase User ID if available
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

    // Build list of landlord IDs to query
    const landlordIdsForQuery: string[] = [String(resolvedUserId)]
    if (user.id && String(user.id) !== String(resolvedUserId)) landlordIdsForQuery.push(String(user.id))
    if (tokenUserId && !landlordIdsForQuery.includes(tokenUserId)) landlordIdsForQuery.push(tokenUserId)

    // Helper for safe field access
    const getField = (obj: any, keys: string[]) => {
      for (const key of keys) {
        const value = obj?.[key]
        if (value !== undefined && value !== null && value !== '') return value
      }
      return undefined
    }

    const isConnectionError = (error: any) => {
      const msg = String(error?.message || '').toLowerCase()
      return msg.includes('server has closed the connection') ||
        msg.includes('connection') ||
        msg.includes('timeout') ||
        msg.includes('pool') ||
        msg.includes('maxclients')
    }

    const runWithRetry = async <T,>(fn: () => Promise<T>): Promise<T> => {
      try {
        return await fn()
      } catch (error: any) {
        if (!isConnectionError(error)) throw error
        try { await prisma.$disconnect() } catch {}
        try { await prisma.$connect() } catch {}
        return await fn()
      }
    }

    // Determine if we should use Supabase REST
    let useSupabaseRest = false
    if (region === 'global') {
      try {
        await runWithRetry(() => prisma.user.count())
      } catch (error: any) {
        if (isConnectionError(error)) useSupabaseRest = true
        else throw error
      }
    }
    
    // Find Properties first
    let properties: any[] = []
    if (region === 'global' && !useSupabaseRest) {
      properties = await runWithRetry(() => prisma.property.findMany({
        where: { landlordId: landlordIdsForQuery.length === 1 ? landlordIdsForQuery[0] : { in: landlordIdsForQuery } },
        select: { id: true, title: true, address: true, images: true }
      }))
      if (properties.length === 0 && supabaseReaders.length > 0) useSupabaseRest = true
    }

    if (region === 'global' && useSupabaseRest) {
      if (supabaseReaders.length === 0) return NextResponse.json({ applications: [] })
      const propertyTables = ['Property', 'property', 'properties', 'Listing', 'listing', 'listings']
      const landlordFields = ['landlordId', 'landlord_id', 'ownerId', 'owner_id', 'userId', 'user_id']
      
      for (const client of supabaseReaders) {
        for (const tableName of propertyTables) {
          for (const landlordField of landlordFields) {
            const { data, error } = await client
              .from(tableName)
              .select('id,title,address,images,landlordId,landlord_id')
              .in(landlordField, landlordIdsForQuery)
            if (!error && data) {
              properties = data.map((row: any) => ({
                id: row.id,
                title: row.title,
                address: row.address,
                images: row.images,
                landlordId: row.landlordId ?? row.landlord_id
              }))
              break
            }
          }
          if (properties.length > 0) break
        }
        if (properties.length > 0) break
      }
    } else if (region !== 'global') {
      const allProps = await db.query('properties', {})
      const landlordIdSet = new Set(landlordIdsForQuery.map(id => String(id)))
      properties = allProps.filter((p: any) => {
        const ownerId = String(p.landlordId || p.landlord_id || p.ownerId || p.owner_id || p.userId || p.user_id || '')
        return ownerId && landlordIdSet.has(ownerId)
      })
    }

    const propertyIds = properties.map(p => String(p.id || p._id)).filter(Boolean)
    const propertyMap = new Map(properties.map(p => [String(p.id || p._id), p]))

    let applications: any[] = []

    if (region === 'global' && !useSupabaseRest) {
      const apps = await runWithRetry(() => prisma.application.findMany({
        where: { propertyId: { in: propertyIds } },
        include: {
          tenant: {
            select: { id: true, name: true, email: true, avatar: true }
          }
        },
        orderBy: { updatedAt: 'desc' }
      }))
      
      applications = apps.map(app => ({
        id: app.id,
        status: app.status,
        appliedDate: app.createdAt,
        updatedAt: app.updatedAt,
        property: propertyMap.get(String(app.propertyId)) || null,
        applicant: {
          id: app.tenant?.id,
          name: app.tenant?.name || 'Unknown',
          email: app.tenant?.email,
          image: app.tenant?.avatar
        },
        message: app.message
      }))
    } else if (region === 'global') {
      const appTables = ['Application', 'application', 'applications']
      const propIdFields = ['propertyId', 'property_id']
      
      for (const client of supabaseReaders) {
        for (const tableName of appTables) {
          for (const propField of propIdFields) {
            const { data, error } = await client
              .from(tableName)
              .select('*')
              .in(propField, propertyIds)
              .order('created_at', { ascending: false })
            
            if (!error && data) {
              // We need to fetch tenant info separately for Supabase REST
              const tenantIds = [...new Set(data.map((a: any) => getField(a, ['tenantId', 'tenant_id'])))].filter(Boolean)
              let tenants: any[] = []
              
              if (tenantIds.length > 0) {
                 const userTables = ['User', 'user', 'users', 'Profile', 'profile', 'profiles']
                 for (const uTable of userTables) {
                   const { data: uData } = await client.from(uTable).select('id,name,email,avatar,image').in('id', tenantIds)
                   if (uData) {
                     tenants = uData
                     break
                   }
                 }
              }
              const tenantMap = new Map(tenants.map(t => [String(t.id), t]))

              applications = data.map((app: any) => {
                const tenantId = String(getField(app, ['tenantId', 'tenant_id']))
                const tenant = tenantMap.get(tenantId)
                const propId = String(getField(app, ['propertyId', 'property_id']))
                
                return {
                  id: getField(app, ['id', '_id']),
                  status: app.status,
                  appliedDate: getField(app, ['created_at', 'createdAt']),
                  updatedAt: getField(app, ['updated_at', 'updatedAt']),
                  property: propertyMap.get(propId) || null,
                  applicant: {
                    id: tenantId,
                    name: tenant?.name || 'Unknown',
                    email: tenant?.email,
                    image: tenant?.image || tenant?.avatar
                  },
                  message: app.message
                }
              })
              break
            }
          }
          if (applications.length > 0) break
        }
        if (applications.length > 0) break
      }
    } else {
      // CloudBase/Local
      const rawApps = await db.query('applications', {})
      const tenantIds = new Set<string>()
      
      const filteredApps = rawApps.filter((app: any) => {
        const pid = String(getField(app, ['propertyId', 'property_id']) || '')
        return pid && propertyMap.has(pid)
      })

      filteredApps.forEach((app: any) => {
        const tid = String(getField(app, ['tenantId', 'tenant_id']) || '')
        if (tid) tenantIds.add(tid)
      })

      // Fetch tenants
      const tenants: any[] = []
      for (const tid of tenantIds) {
        const t = await db.findUserById(tid).catch(() => null)
        if (t) tenants.push(t)
      }
      const tenantMap = new Map(tenants.map(t => [String(t.id), t]))

      applications = filteredApps.map((app: any) => {
        const tid = String(getField(app, ['tenantId', 'tenant_id']) || '')
        const tenant = tenantMap.get(tid)
        const pid = String(getField(app, ['propertyId', 'property_id']) || '')
        
        return {
          id: app.id || app._id,
          status: app.status,
          appliedDate: app.createdAt || app.created_at,
          updatedAt: app.updatedAt || app.updated_at,
          property: propertyMap.get(pid) || null,
          applicant: {
            id: tid,
            name: tenant?.name || 'Unknown',
            email: tenant?.email,
            image: tenant?.avatar || tenant?.image
          },
          message: app.message
        }
      })
    }

    return NextResponse.json({ applications })

  } catch (error: any) {
    console.error('Error fetching landlord applications:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

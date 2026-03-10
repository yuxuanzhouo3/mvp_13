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
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const region = getAppRegion()
    const db = getDatabaseAdapter()
    let resolvedUserId = user.id

    try {
      const userById = await db.findUserById(user.id)
      const userByEmail = !userById && user.email ? await db.findUserByEmail(user.email) : null
      const resolvedUser = userById || userByEmail
      if (resolvedUser?.id) resolvedUserId = resolvedUser.id
    } catch {}

    const landlordIdsForQuery: string[] = [String(resolvedUserId)]
    if (user.id && String(user.id) !== String(resolvedUserId)) landlordIdsForQuery.push(String(user.id))

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

    let payments: any[] = []
    let useSupabaseRest = false

    if (region === 'global') {
      try {
        await runWithRetry(() => prisma.user.count())
      } catch (error: any) {
        if (isConnectionError(error)) useSupabaseRest = true
        else throw error
      }
    }

    if (region === 'global' && !useSupabaseRest) {
      // Fetch via Prisma
      // 1. Find properties
      const properties = await runWithRetry(() => prisma.property.findMany({
        where: { landlordId: { in: landlordIdsForQuery } },
        select: { id: true, title: true }
      }))
      const propertyIds = properties.map(p => p.id)
      const propertyMap = new Map(properties.map(p => [p.id, p]))

      // 2. Find leases
      const leases = await runWithRetry(() => prisma.lease.findMany({
        where: { propertyId: { in: propertyIds } },
        select: { id: true, propertyId: true, tenantId: true }
      }))
      const leaseIds = leases.map(l => l.id)
      const leaseMap = new Map(leases.map(l => [l.id, l]))

      // 3. Find payments linked to leases
      // Also try to find payments directly linked to the landlord if schema supports it (e.g. recipientId)
      // or loosely linked via tenant
      const paymentsQuery: any = {
        where: { 
          OR: [
            { leaseId: { in: leaseIds } },
            { propertyId: { in: propertyIds } }
          ]
        },
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: { select: { name: true, email: true } },
          lease: { select: { propertyId: true } },
          property: { select: { title: true } }
        }
      }

      payments = await runWithRetry(() => prisma.payment.findMany(paymentsQuery))

      // Format payments
      payments = payments.map(p => {
        const lease = p.lease || (p.leaseId ? leaseMap.get(p.leaseId) : null)
        const property = p.property || (p.propertyId ? propertyMap.get(p.propertyId) : (lease ? propertyMap.get(lease.propertyId) : null))
        
        return {
          id: p.id,
          amount: p.amount,
          status: p.status,
          date: p.createdAt,
          type: p.type,
          propertyTitle: property?.title || 'Unknown Property',
          tenantName: p.tenant?.name || 'Unknown Tenant',
          description: p.description
        }
      })
    } else if (region === 'global') {
      // Supabase REST
      // Similar logic: Properties -> Leases -> Payments
      // This is complex for REST, so simplified:
      // Try to find payments where landlord_id matches (if exists) or join manually
      // Assuming Payments have lease_id
      // TODO: Implement Supabase REST fallback for payments if critical
      // For now returning empty array or basic mock if needed, but let's try to do it right
      // Fetch properties first
      const supabaseClient = createSupabaseServerClient(request.headers.get('authorization')?.replace('Bearer ', ''))
      const readers = [supabaseAdmin, supabaseClient].filter(Boolean) as any[]
      
      let properties: any[] = []
      for (const client of readers) {
         const { data } = await client.from('Property').select('id,title').in('landlordId', landlordIdsForQuery)
         if (data) { properties = data; break }
      }
      const propIds = properties.map(p => p.id)
      const propMap = new Map(properties.map(p => [p.id, p]))

      let leases: any[] = []
      for (const client of readers) {
         const { data } = await client.from('Lease').select('id,propertyId').in('propertyId', propIds)
         if (data) { leases = data; break }
      }
      const leaseIds = leases.map(l => l.id)
      const leaseMap = new Map(leases.map(l => [l.id, l]))

      for (const client of readers) {
         const { data } = await client.from('Payment')
           .select('id,amount,status,createdAt,type,leaseId,propertyId,tenantId')
           .or(`leaseId.in.(${leaseIds.join(',')}),propertyId.in.(${propIds.join(',')})`)
           .order('createdAt', { ascending: false })
         
         if (data) {
           // Need to fetch tenant names
           const tenantIds = [...new Set(data.map((p:any) => p.tenantId))].filter(Boolean)
           let tenants: any[] = []
           if (tenantIds.length > 0) {
             const { data: tData } = await client.from('User').select('id,name').in('id', tenantIds)
             if (tData) tenants = tData
           }
           const tenantMap = new Map(tenants.map(t => [t.id, t]))

           payments = data.map((p: any) => {
             const lease = p.leaseId ? leaseMap.get(p.leaseId) : null
             const prop = p.propertyId ? propMap.get(p.propertyId) : (lease ? propMap.get(lease.propertyId) : null)
             const tenant = tenantMap.get(p.tenantId)

             return {
                id: p.id,
                amount: p.amount,
                status: p.status,
                date: p.createdAt,
                type: p.type,
                propertyTitle: prop?.title || 'Unknown Property',
                tenantName: tenant?.name || 'Unknown Tenant',
                description: p.description
             }
           })
           break
         }
      }
    } else {
      // CloudBase/Local
      // 1. Get properties
      const allProps = await db.query('properties', {})
      const landlordIdSet = new Set(landlordIdsForQuery.map(id => String(id)))
      const myProps = allProps.filter((p: any) => {
         const ownerId = String(p.landlordId || p.landlord_id || p.ownerId || p.owner_id || p.userId || p.user_id || '')
         return ownerId && landlordIdSet.has(ownerId)
      })
      const propIds = new Set(myProps.map((p: any) => String(p.id || p._id)))
      const propMap = new Map(myProps.map((p: any) => [String(p.id || p._id), p]))

      // 2. Get leases (optional, if payments linked to leases)
      const allLeases = await db.query('leases', {})
      const myLeases = allLeases.filter((l: any) => {
         const pid = String(getField(l, ['propertyId', 'property_id']) || '')
         return pid && propIds.has(pid)
      })
      const leaseIds = new Set(myLeases.map((l: any) => String(l.id || l._id)))
      const leaseMap = new Map(myLeases.map((l: any) => [String(l.id || l._id), l]))

      // 3. Get payments
      const allPayments = await db.query('payments', {})
      payments = allPayments.filter((p: any) => {
         const lid = String(getField(p, ['leaseId', 'lease_id']) || '')
         const pid = String(getField(p, ['propertyId', 'property_id']) || '')
         // Relaxed check: also check if tenant belongs to one of the leases
         const tid = String(getField(p, ['tenantId', 'tenant_id', 'userId', 'user_id']) || '')
         
         // If direct link exists
         if ((lid && leaseIds.has(lid)) || (pid && propIds.has(pid))) return true
         
         // If tenant link exists (payment from a tenant who has a lease with this landlord)
         if (tid) {
            // Check if this tenant has any lease in myLeases
            const tenantHasLease = myLeases.some((l: any) => {
               const lTid = String(getField(l, ['tenantId', 'tenant_id']) || '')
               return lTid === tid
            })
            if (tenantHasLease) return true
         }
         
         return false
      }).map((p: any) => {
         const lid = String(getField(p, ['leaseId', 'lease_id']) || '')
         const pid = String(getField(p, ['propertyId', 'property_id']) || '')
         const lease = lid ? leaseMap.get(lid) : null
         const prop = pid ? propMap.get(pid) : (lease ? propMap.get(String(getField(lease, ['propertyId', 'property_id']))) : null)
         
         // Try to find tenant name
         const tid = String(getField(p, ['tenantId', 'tenant_id', 'userId', 'user_id']) || '')
         let tenantName = 'Unknown Tenant'
         if (tid) {
             const relatedLease = myLeases.find((l: any) => String(getField(l, ['tenantId', 'tenant_id']) || '') === tid)
             if (relatedLease) {
                 tenantName = relatedLease.tenantName || relatedLease.tenant_name || 'Tenant'
             }
         }

         return {
            id: p.id || p._id,
            amount: p.amount,
            status: p.status,
            date: p.createdAt || p.created_at,
            type: p.type,
            propertyTitle: prop?.title || 'Unknown Property',
            tenantName: tenantName,
            description: p.description
         }
      })
    }

    return NextResponse.json({ payments })

  } catch (error: any) {
    console.error('Error fetching landlord payments:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

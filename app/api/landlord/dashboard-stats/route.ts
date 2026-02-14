import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getAuthUser } from '@/lib/auth'
import { getAppRegion, getDatabaseAdapter } from '@/lib/db-adapter'
import { prisma } from '@/lib/db'
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase'

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

export async function GET(request: NextRequest) {
  try {
    let user = await getCurrentUser(request)
    if (!user) {
      const legacy = await getAuthUser(request)
      if (legacy) {
        user = {
          id: legacy.userId || legacy.id,
          email: legacy.email || '',
          userType: legacy.userType
        }
      }
    }
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const region = getAppRegion()
    const db = getDatabaseAdapter()
    const authHeader = request.headers.get('authorization')
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined
    const supabaseClient = createSupabaseServerClient(accessToken)
    const supabaseReaders = [supabaseClient, supabaseAdmin].filter(Boolean) as any[]
    const userIds = new Set<string>([String(user.id)])
    let userEmail = user.email || ''
    if (accessToken && supabaseClient) {
      try {
        const { data } = await supabaseClient.auth.getUser(accessToken)
        if (data?.user?.id) {
          userIds.add(String(data.user.id))
        }
        if (data?.user?.email && !userEmail) {
          userEmail = data.user.email
        }
      } catch {}
    }
    if (!userEmail && accessToken && supabaseAdmin) {
      try {
        const { data } = await supabaseAdmin.auth.getUser(accessToken)
        if (data?.user?.id) {
          userIds.add(String(data.user.id))
        }
        if (data?.user?.email && !userEmail) {
          userEmail = data.user.email
        }
      } catch {}
    }
    if (userEmail && supabaseReaders.length > 0) {
      const userTables = ['User', 'user', 'users', 'Profile', 'profile', 'profiles']
      for (const client of supabaseReaders) {
        for (const tableName of userTables) {
          const { data, error } = await client
            .from(tableName)
            .select('id,email')
            .ilike('email', userEmail)
            .limit(1)
          if (!error && data && data.length > 0) {
            userIds.add(String(data[0].id))
            break
          }
        }
        if (userIds.size > 1) break
      }
    }

    let totalProperties = 0
    let activeTenants = 0
    let monthlyRevenue = 0
    let pendingIssues = 0

    const runWithRetry = async <T,>(fn: () => Promise<T>): Promise<T> => {
      try {
        return await fn()
      } catch (error: any) {
        if (!isConnectionError(error)) {
          throw error
        }
        try {
          await prisma.$disconnect()
        } catch {}
        try {
          await prisma.$connect()
        } catch {}
        return await fn()
      }
    }

    const computeSupabaseStats = async () => {
      let totalProperties = 0
      let activeTenants = 0
      let monthlyRevenue = 0
      let pendingIssues = 0
      if (supabaseReaders.length === 0) {
        return { totalProperties, activeTenants, monthlyRevenue, pendingIssues }
      }
      const propertyTables = ['Property', 'property', 'properties', 'Listing', 'listing', 'listings']
      const landlordFields = ['landlordId', 'landlord_id', 'ownerId', 'owner_id', 'userId', 'user_id']
      const emailFields = ['landlordEmail', 'landlord_email', 'ownerEmail', 'owner_email', 'userEmail', 'user_email']
      const landlordIds = Array.from(userIds)
      let properties: any[] = []
      for (const client of supabaseReaders) {
        for (const tableName of propertyTables) {
          for (const landlordField of landlordFields) {
            const { data, error } = await client
              .from(tableName)
              .select('id,landlordId,landlord_id')
              .in(landlordField, landlordIds)
            if (!error && data && data.length > 0) {
              properties = data
              break
            }
          }
          if (properties.length > 0) break
        }
        if (properties.length > 0) break
      }
      if (properties.length === 0 && userEmail) {
        for (const client of supabaseReaders) {
          for (const tableName of propertyTables) {
            for (const landlordField of landlordFields) {
              const { data, error } = await client
                .from(tableName)
                .select('id,landlordId,landlord_id')
                .ilike(landlordField, userEmail)
              if (!error && data && data.length > 0) {
                properties = data
                break
              }
            }
            if (properties.length > 0) break
          }
          if (properties.length > 0) break
        }
      }
      if (properties.length === 0 && userEmail) {
        for (const client of supabaseReaders) {
          for (const tableName of propertyTables) {
            for (const emailField of emailFields) {
              const { data, error } = await client
                .from(tableName)
                .select('id,landlordId,landlord_id')
                .ilike(emailField, userEmail)
              if (!error && data && data.length > 0) {
                properties = data
                break
              }
            }
            if (properties.length > 0) break
          }
          if (properties.length > 0) break
        }
      }
      totalProperties = properties.length
      const propertyIds = Array.from(new Set(properties.map((p: any) => String(p.id)).filter(Boolean)))

      const tenantIdSet = new Set<string>()
      const applicationTables = ['Application', 'application', 'applications']
      const leaseTables = ['Lease', 'lease', 'leases']
      const paymentTables = ['Payment', 'payment', 'payments']
      const notificationTables = ['Notification', 'notification', 'notifications']
      const propertyIdFields = ['propertyId', 'property_id']
      const tenantFields = ['tenantId', 'tenant_id']
      const statusFields = ['status']
      const landlordFieldsOnLease = ['landlordId', 'landlord_id', 'ownerId', 'owner_id', 'userId', 'user_id']

      if (propertyIds.length > 0) {
        for (const client of supabaseReaders) {
          for (const tableName of applicationTables) {
            for (const propertyField of propertyIdFields) {
              let query = client
                .from(tableName)
                .select('id,tenantId,tenant_id,status')
                .in(propertyField, propertyIds)
              for (const statusField of statusFields) {
                const { data, error } = await query.eq(statusField, 'APPROVED')
                if (!error && data) {
                  data.forEach((row: any) => {
                    const tid = getField(row, tenantFields)
                    if (tid) tenantIdSet.add(String(tid))
                  })
                  break
                }
              }
            }
          }
        }
      } else if (landlordIds.length > 0) {
        const applicationLandlordFields = ['landlordId', 'landlord_id', 'ownerId', 'owner_id', 'userId', 'user_id']
        for (const client of supabaseReaders) {
          for (const tableName of applicationTables) {
            for (const landlordField of applicationLandlordFields) {
              let query = client
                .from(tableName)
                .select('id,tenantId,tenant_id,status')
                .in(landlordField, landlordIds)
              for (const statusField of statusFields) {
                const { data, error } = await query.eq(statusField, 'APPROVED')
                if (!error && data) {
                  data.forEach((row: any) => {
                    const tid = getField(row, tenantFields)
                    if (tid) tenantIdSet.add(String(tid))
                  })
                  break
                }
              }
            }
          }
        }
      }

      for (const client of supabaseReaders) {
        for (const tableName of leaseTables) {
          for (const landlordField of landlordFieldsOnLease) {
            let query = client
              .from(tableName)
              .select('tenantId,tenant_id,status')
              .in(landlordField, landlordIds)
            for (const statusField of statusFields) {
              const { data, error } = await query.eq(statusField, 'ACTIVE')
              if (!error && data) {
                data.forEach((row: any) => {
                  const tid = getField(row, tenantFields)
                  if (tid) tenantIdSet.add(String(tid))
                })
                break
              }
            }
          }
        }
      }

      activeTenants = tenantIdSet.size

      if (propertyIds.length > 0) {
        const paymentPropertyFields = ['propertyId', 'property_id']
        const now = new Date()
        for (const client of supabaseReaders) {
          for (const tableName of paymentTables) {
            for (const propertyField of paymentPropertyFields) {
              const { data, error } = await client
                .from(tableName)
                .select('*')
                .in(propertyField, propertyIds)
              if (!error && data) {
                data.forEach((row: any) => {
                  const status = String(row.status || '').toUpperCase()
                  if (status !== 'PAID' && status !== 'COMPLETED') return
                  const dateValue = getField(row, ['paidAt', 'paid_at', 'createdAt', 'created_at', 'updatedAt', 'updated_at'])
                  const date = new Date(dateValue || 0)
                  if (date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()) return
                  const dist = row.distribution || {}
                  const amount = Number(dist.landlordNet ?? row.landlordNet ?? row.amount ?? row.total ?? 0)
                  monthlyRevenue += isNaN(amount) ? 0 : amount
                })
                break
              }
            }
          }
        }
      }

      for (const client of supabaseReaders) {
        for (const tableName of notificationTables) {
          const userFields = ['userId', 'user_id']
          const readFields = ['isRead', 'is_read']
          for (const userField of userFields) {
            for (const readField of readFields) {
              let query = client
                .from(tableName)
                .select('id')
              if (landlordIds.length > 1) {
                query = query.in(userField, landlordIds)
              } else {
                query = query.eq(userField, landlordIds[0])
              }
              const { data, error } = await query.eq(readField, false)
              if (!error && data) {
                pendingIssues = data.length
                break
              }
            }
          }
          if (pendingIssues > 0) break
        }
        if (pendingIssues > 0) break
      }

      return { totalProperties, activeTenants, monthlyRevenue, pendingIssues }
    }

    let useSupabaseRest = false
    if (region === 'global') {
      try {
        await runWithRetry(() => prisma.user.count())
      } catch (error: any) {
        if (!isConnectionError(error)) {
          throw error
        }
        useSupabaseRest = true
      }
    }

    if (region === 'global' && !useSupabaseRest) {
      let resolvedUserId = String(user.id)
      try {
        const dbUser =
          (await db.findUserById(user.id).catch(() => null)) ||
          (user.email ? await db.findUserByEmail(user.email).catch(() => null) : null)
        if (dbUser?.id) {
          resolvedUserId = String(dbUser.id)
        }
      } catch {}
      const landlordIds = Array.from(new Set([String(user.id), resolvedUserId]))
      const properties = await runWithRetry(() => prisma.property.findMany({
        where: { landlordId: landlordIds.length === 1 ? landlordIds[0] : { in: landlordIds } },
        select: { id: true }
      }))
      totalProperties = properties.length
      const propertyIds = properties.map((p) => p.id)
      const approvedApplications = await runWithRetry(() => prisma.application.findMany({
        where: { propertyId: { in: propertyIds }, status: 'APPROVED' },
        select: { tenantId: true }
      }))
      const activeLeases = await runWithRetry(() => prisma.lease.findMany({
        where: { landlordId: landlordIds.length === 1 ? landlordIds[0] : { in: landlordIds }, status: 'ACTIVE' },
        select: { tenantId: true }
      }))
      const tenantIdSet = new Set<string>()
      approvedApplications.forEach((a) => tenantIdSet.add(String(a.tenantId)))
      activeLeases.forEach((l) => tenantIdSet.add(String(l.tenantId)))
      activeTenants = tenantIdSet.size
      const now = new Date()
      const payments = await runWithRetry(() => prisma.payment.findMany({
        where: { propertyId: { in: propertyIds } }
      }))
      payments.forEach((p: any) => {
        const status = String(p.status || '').toUpperCase()
        if (status !== 'PAID' && status !== 'COMPLETED') return
        const date = new Date(p.paidAt || p.createdAt || p.updatedAt || 0)
        if (date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()) return
        const dist = p.distribution || {}
        const amount = Number(dist.landlordNet ?? p.landlordNet ?? p.amount ?? p.total ?? 0)
        monthlyRevenue += isNaN(amount) ? 0 : amount
      })
      pendingIssues = await runWithRetry(() => prisma.notification.count({
        where: { userId: landlordIds.length === 1 ? landlordIds[0] : { in: landlordIds }, isRead: false }
      }))
      if (supabaseAdmin && totalProperties === 0 && userEmail) {
        const sbStats = await computeSupabaseStats()
        if (sbStats.totalProperties || sbStats.activeTenants || sbStats.monthlyRevenue || sbStats.pendingIssues) {
          totalProperties = sbStats.totalProperties
          activeTenants = sbStats.activeTenants
          monthlyRevenue = sbStats.monthlyRevenue
          pendingIssues = sbStats.pendingIssues
        }
      }
    } else if (supabaseReaders.length > 0) {
      const sbStats = await computeSupabaseStats()
      totalProperties = sbStats.totalProperties
      activeTenants = sbStats.activeTenants
      monthlyRevenue = sbStats.monthlyRevenue
      pendingIssues = sbStats.pendingIssues
    } else {
      const landlordId = user.id
      const properties = await db.query('properties', { landlordId })
      totalProperties = properties.length
      const ids = properties.map((p: any) => p.id)
      const applications = await db.query('applications', { status: 'APPROVED' })
      const leases = await db.query('leases', { status: 'ACTIVE' })
      const tenantIdSet = new Set<string>()
      applications.forEach((a: any) => {
        if (ids.includes(a.propertyId)) tenantIdSet.add(String(a.tenantId))
      })
      leases.forEach((l: any) => {
        if (String(l.landlordId) === String(landlordId)) tenantIdSet.add(String(l.tenantId))
      })
      activeTenants = tenantIdSet.size
      const payments = await db.query('payments', {})
      const now = new Date()
      payments.forEach((p: any) => {
        if (!ids.includes(p.propertyId)) return
        const status = String(p.status || '').toUpperCase()
        if (status !== 'PAID' && status !== 'COMPLETED') return
        const date = new Date(p.paidAt || p.createdAt || p.updatedAt || 0)
        if (date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()) return
        const dist = p.distribution || {}
        const amount = Number(dist.landlordNet ?? p.landlordNet ?? p.amount ?? p.total ?? 0)
        monthlyRevenue += isNaN(amount) ? 0 : amount
      })
      const notifications = await db.query('notifications', { userId: landlordId, isRead: false })
      pendingIssues = notifications.length
    }

    return NextResponse.json({
      stats: {
        totalProperties,
        activeTenants,
        monthlyRevenue,
        pendingIssues
      }
    })
  } catch (error: any) {
    if (isConnectionError(error) && (supabaseAdmin || supabaseClient)) {
      try {
        const sbStats = await computeSupabaseStats()
        return NextResponse.json({ stats: sbStats })
      } catch {}
      return NextResponse.json({
        stats: {
          totalProperties: 0,
          activeTenants: 0,
          monthlyRevenue: 0,
          pendingIssues: 0
        }
      })
    }
    return NextResponse.json(
      { error: 'Failed to get dashboard stats', details: error.message },
      { status: 500 }
    )
  }
}

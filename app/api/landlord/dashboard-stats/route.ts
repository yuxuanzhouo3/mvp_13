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

const normalizeId = (value: any) => String(value ?? '').trim()

const isConnectionError = (error: any) => {
  const msg = String(error?.message || '').toLowerCase()
  return msg.includes('server has closed the connection') ||
    msg.includes('connection') ||
    msg.includes('timeout') ||
    msg.includes('pool') ||
    msg.includes('maxclients')
}

export async function GET(request: NextRequest) {
  let supabaseClient: any = null
  let supabaseReaders: any[] = []
  let computeSupabaseStats = async () => ({
    totalProperties: 0,
    activeTenants: 0,
    monthlyRevenue: 0,
    pendingIssues: 0,
  })
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
    supabaseClient = createSupabaseServerClient(accessToken)
    supabaseReaders = [supabaseAdmin, supabaseClient].filter(Boolean) as any[]
    const userIds = new Set<string>()
    const baseUserId = normalizeId(user.id)
    if (baseUserId) userIds.add(baseUserId)
    const hintedUserId = normalizeId(request.headers.get('x-user-id') || '')
    if (hintedUserId) userIds.add(hintedUserId)
    const hintedUserEmail = String(request.headers.get('x-user-email') || '').trim()
    let userEmail = user.email || hintedUserEmail || ''
    if (accessToken && supabaseClient) {
      try {
        const { data } = await supabaseClient.auth.getUser(accessToken)
        if (data?.user?.id) {
          const authUserId = normalizeId(data.user.id)
          if (authUserId) userIds.add(authUserId)
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
          const authUserId = normalizeId(data.user.id)
          if (authUserId) userIds.add(authUserId)
        }
        if (data?.user?.email && !userEmail) {
          userEmail = data.user.email
        }
      } catch {}
    }
    if (userEmail && supabaseAdmin) {
      try {
        const adminApi = (supabaseAdmin as any)?.auth?.admin || (supabaseAdmin as any)?.auth?.api
        if (adminApi?.getUserByEmail) {
          const result = await adminApi.getUserByEmail(userEmail)
          const adminUser = result?.data?.user
          if (adminUser?.id) {
            const adminUserId = normalizeId(adminUser.id)
            if (adminUserId) userIds.add(adminUserId)
          }
        } else if (adminApi?.listUsers) {
          const listResult = await adminApi.listUsers()
          const users = listResult?.data?.users || listResult?.data || []
          const found = Array.isArray(users)
            ? users.find((u: any) => String(u?.email || '').toLowerCase() === userEmail.toLowerCase())
            : null
          if (found?.id) {
            const foundUserId = normalizeId(found.id)
            if (foundUserId) userIds.add(foundUserId)
          }
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
            const matchedUserId = normalizeId(data[0].id)
            if (matchedUserId) userIds.add(matchedUserId)
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
    const withTimeoutValue = async <T,>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> => {
      return await Promise.race([
        promise,
        new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
      ])
    }

    computeSupabaseStats = async () => {
      let totalProperties = 0
      let activeTenants = 0
      let monthlyRevenue = 0
      let pendingIssues = 0
      if (supabaseReaders.length === 0) {
        return { totalProperties, activeTenants, monthlyRevenue, pendingIssues }
      }
      const propertyTables = ['Property', 'property', 'properties', 'Listing', 'listing', 'listings']
      const landlordFields = ['landlordId', 'landlord_id', 'landlord', 'ownerId', 'owner_id', 'owner', 'userId', 'user_id', 'user', 'createdBy', 'created_by']
      const emailFields = ['landlordEmail', 'landlord_email', 'ownerEmail', 'owner_email', 'userEmail', 'user_email']
      const landlordIds = Array.from(userIds)
      const normalizedEmail = userEmail?.toLowerCase()
      const matchesLandlord = (row: any) => {
        const rawCandidates = [
          row?.landlordId,
          row?.landlord_id,
          row?.landlord,
          row?.ownerId,
          row?.owner_id,
          row?.owner,
          row?.userId,
          row?.user_id,
          row?.user,
          row?.createdBy,
          row?.created_by,
        ]
        const candidateIds = rawCandidates
          .filter((v) => v !== undefined && v !== null && v !== '')
          .map((v) => String(v))
        const candidateEmails = [
          row?.landlordEmail,
          row?.landlord_email,
          row?.ownerEmail,
          row?.owner_email,
          row?.userEmail,
          row?.user_email,
          row?.email,
        ]
          .filter((v) => v !== undefined && v !== null && v !== '')
          .map((v) => String(v).toLowerCase())
        const nested = [row?.landlord, row?.owner, row?.user]
          .filter((v) => v && typeof v === 'object')
        nested.forEach((obj: any) => {
          const id = obj?.id || obj?.userId || obj?.ownerId || obj?.landlordId
          if (id) {
            const idStr = String(id)
            candidateIds.push(idStr)
            // 兼容 landlordId 等字段被误用为邮箱的情况
            if (idStr.includes('@')) {
              candidateEmails.push(idStr.toLowerCase())
            }
          }
          const email = obj?.email
          if (email) candidateEmails.push(String(email).toLowerCase())
        })
        // 如果 landlordId/ownerId 等字段本身就是邮箱，也纳入邮箱匹配集合
        rawCandidates.forEach((v) => {
          if (v === undefined || v === null) return
          const s = String(v).trim()
          if (!s) return
          if (s.includes('@')) {
            candidateEmails.push(s.toLowerCase())
          }
        })
        if (candidateIds.some((id) => landlordIds.includes(id))) return true
        if (normalizedEmail && candidateEmails.includes(normalizedEmail)) return true
        return false
      }
      let properties: any[] = []
      for (const client of supabaseReaders) {
        for (const tableName of propertyTables) {
          for (const landlordField of landlordFields) {
            const { data, error } = await client
              .from(tableName)
              .select('*')
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
                .select('*')
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
                .select('*')
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
      if (properties.length === 0) {
        const scanLimit = 200
        for (const client of supabaseReaders) {
          for (const tableName of propertyTables) {
            const { data, error } = await client
              .from(tableName)
              .select('*')
              .range(0, scanLimit - 1)
            if (!error && data && data.length > 0) {
              const matched = data.filter(matchesLandlord)
              if (matched.length > 0) {
                properties = matched
                break
              }
            }
          }
          if (properties.length > 0) break
        }
      }
      if (properties.length === 0) {
        try {
          const candidates = await prisma.$queryRawUnsafe(
            `SELECT table_name
             FROM information_schema.columns
             WHERE table_schema = 'public' AND column_name IN ('title','address','price')
             GROUP BY table_name
             HAVING COUNT(*) >= 2`
          ) as { table_name: string }[]
          const tableNames = (candidates || [])
            .map((row) => row.table_name)
            .filter((name) => /^[a-zA-Z0-9_]+$/.test(name))
          for (const tableName of tableNames) {
            const columns = await prisma.$queryRawUnsafe(
              `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
              tableName
            ) as { column_name: string }[]
            const columnSet = new Set((columns || []).map((col) => String(col.column_name)))
            const orderKey = columnSet.has('createdAt')
              ? 'createdAt'
              : columnSet.has('created_at')
                ? 'created_at'
                : null
            const orderClause = orderKey ? `ORDER BY "${orderKey}" DESC` : ''
            const sql = `SELECT * FROM "${tableName}" ${orderClause} LIMIT $1`
            const rows = await prisma.$queryRawUnsafe(sql, 200) as any[]
            if (!rows || rows.length === 0) continue
            const matched = rows.filter(matchesLandlord)
            if (matched.length > 0) {
              properties = matched
              break
            }
          }
        } catch {}
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

    const computeDbQueryStats = async () => {
      let totalProperties = 0
      let activeTenants = 0
      let monthlyRevenue = 0
      let pendingIssues = 0
      const landlordIdSet = new Set<string>(Array.from(userIds).map((id) => normalizeId(id)).filter(Boolean))
      if (user?.id) {
        const uid = normalizeId(user.id)
        if (uid) landlordIdSet.add(uid)
      }
      if (userEmail) {
        try {
          const dbUser = await db.findUserByEmail(userEmail).catch(() => null)
          const dbUserId = normalizeId(dbUser?.id)
          if (dbUserId) landlordIdSet.add(dbUserId)
        } catch {}
      }
      const normalizedEmail = String(userEmail || user?.email || '').toLowerCase()
      const matchesLandlordRow = (row: any) => {
        const rawIdCandidates = [
          row?.landlordId,
          row?.landlord_id,
          row?.ownerId,
          row?.owner_id,
          row?.userId,
          row?.user_id,
          row?.createdBy,
          row?.created_by,
          row?.landlord?.id,
          row?.owner?.id,
          row?.user?.id,
        ]
        const candidateIds = rawIdCandidates
          .filter((v) => v !== undefined && v !== null && v !== '')
          .map((v) => normalizeId(v))
        if (candidateIds.some((id) => id && landlordIdSet.has(id))) return true
        if (!normalizedEmail) return false
        const candidateEmails = [
          row?.landlordEmail,
          row?.landlord_email,
          row?.ownerEmail,
          row?.owner_email,
          row?.userEmail,
          row?.user_email,
          row?.email,
          row?.landlord?.email,
          row?.owner?.email,
          row?.user?.email,
        ]
          .filter((v) => v !== undefined && v !== null && v !== '')
          .map((v) => String(v).toLowerCase())
        // 兼容 landlordId 等字段被误用为邮箱的情况
        rawIdCandidates.forEach((v) => {
          if (v === undefined || v === null) return
          const s = String(v).trim()
          if (!s) return
          if (s.includes('@')) {
            candidateEmails.push(s.toLowerCase())
          }
        })
        return candidateEmails.includes(normalizedEmail)
      }

      const allProperties = await db.query('properties', {})
      const properties = (allProperties || []).filter(matchesLandlordRow)
      totalProperties = properties.length
      const propertyIdSet = new Set(
        properties
          .map((p: any) => normalizeId(p.id || p._id || p.propertyId || p.property_id))
          .filter(Boolean)
      )

      const approvedStatuses = new Set(['APPROVED', 'approved', 'Approved'])
      const activeStatuses = new Set(['ACTIVE', 'active', 'Active'])
      const tenantIdSet = new Set<string>()

      const applications = await db.query('applications', {})
      ;(applications || []).forEach((a: any) => {
        const status = String(a.status || '')
        if (!approvedStatuses.has(status)) return
        const pid = normalizeId(a.propertyId || a.property_id)
        const ownerId = normalizeId(a.landlordId || a.landlord_id || a.ownerId || a.owner_id || a.userId || a.user_id)
        const ownerEmail = String(a.landlordEmail || a.landlord_email || a.ownerEmail || a.owner_email || a.userEmail || a.user_email || '').toLowerCase()
        const matchedByOwner = (ownerId && landlordIdSet.has(ownerId)) || (normalizedEmail && ownerEmail === normalizedEmail)
        if ((pid && propertyIdSet.has(pid)) || matchedByOwner) {
          const tid = normalizeId(a.tenantId || a.tenant_id)
          if (tid) tenantIdSet.add(tid)
        }
      })

      const leases = await db.query('leases', {})
      ;(leases || []).forEach((l: any) => {
        const status = String(l.status || '')
        if (!activeStatuses.has(status)) return
        const pid = normalizeId(l.propertyId || l.property_id)
        const ownerId = normalizeId(l.landlordId || l.landlord_id || l.ownerId || l.owner_id || l.userId || l.user_id)
        if ((pid && propertyIdSet.has(pid)) || (ownerId && landlordIdSet.has(ownerId))) {
          const tid = normalizeId(l.tenantId || l.tenant_id)
          if (tid) tenantIdSet.add(tid)
        }
      })
      activeTenants = tenantIdSet.size

      const payments = await db.query('payments', {})
      const now = new Date()
      ;(payments || []).forEach((p: any) => {
        const pid = normalizeId(p.propertyId || p.property_id)
        if (!pid || !propertyIdSet.has(pid)) return
        const status = String(p.status || '').toUpperCase()
        if (status !== 'PAID' && status !== 'COMPLETED') return
        const date = new Date(p.paidAt || p.paid_at || p.createdAt || p.created_at || p.updatedAt || p.updated_at || 0)
        if (date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()) return
        let dist: any = p.distribution || {}
        if (typeof dist === 'string') {
          try {
            dist = JSON.parse(dist)
          } catch {
            dist = {}
          }
        }
        const amount = Number(dist.landlordNet ?? p.landlordNet ?? p.amount ?? p.total ?? 0)
        monthlyRevenue += isNaN(amount) ? 0 : amount
      })

      const notifications = await db.query('notifications', {})
      pendingIssues = (notifications || []).filter((n: any) => {
        const uid = normalizeId(n.userId || n.user_id)
        const isRead = n.isRead ?? n.is_read
        return uid && landlordIdSet.has(uid) && isRead === false
      }).length

      return { totalProperties, activeTenants, monthlyRevenue, pendingIssues }
    }

    let useSupabaseRest = false
    if (region === 'global') {
      try {
        // 对 Prisma 连接做一次快速健康检查，如果 2 秒内无响应则直接切换到 Supabase 统计路径，
        // 避免在国内网络环境下长时间卡在数据库连接上
        const health = await withTimeoutValue(
          prisma.user.count(),
          2000,
          null as any
        )
        if (health === null) {
          useSupabaseRest = true
        }
      } catch (error: any) {
        console.warn(
          'Prisma health check failed, switching dashboard stats to fallback source:',
          error
        )
        useSupabaseRest = true
      }
    }

    if (region === 'global' && !useSupabaseRest) {
      try {
        let resolvedUserId = normalizeId(user.id)
        try {
          const dbUser =
            (await db.findUserById(user.id).catch(() => null)) ||
            (user.email ? await db.findUserByEmail(user.email).catch(() => null) : null)
          if (dbUser?.id) {
            resolvedUserId = normalizeId(dbUser.id)
          }
        } catch {}
        const landlordIdSet = new Set<string>(Array.from(userIds).map((id) => normalizeId(id)).filter(Boolean))
        if (resolvedUserId) landlordIdSet.add(resolvedUserId)
        const rawUserId = normalizeId(user.id)
        if (rawUserId) landlordIdSet.add(rawUserId)
        if (user.email) {
          try {
            const dbUserByEmail = await db.findUserByEmail(user.email).catch(() => null)
            const dbUserEmailId = normalizeId(dbUserByEmail?.id)
            if (dbUserEmailId) landlordIdSet.add(dbUserEmailId)
          } catch {}
        }
        let landlordIds = Array.from(landlordIdSet).filter(Boolean)
        let properties = landlordIds.length > 0
          ? await runWithRetry(() => prisma.property.findMany({
              where: { landlordId: landlordIds.length === 1 ? landlordIds[0] : { in: landlordIds } },
              select: { id: true, landlordId: true }
            }))
          : []
        if (properties.length === 0 && userEmail) {
          properties = await runWithRetry(() => prisma.property.findMany({
            where: {
              landlord: {
                email: { equals: userEmail, mode: 'insensitive' }
              }
            },
            select: { id: true, landlordId: true }
          }))
        }
        const propertyLandlordIds = properties
          .map((p: any) => normalizeId(p.landlordId))
          .filter(Boolean)
        if (propertyLandlordIds.length > 0) {
          propertyLandlordIds.forEach((id: string) => landlordIdSet.add(id))
          landlordIds = Array.from(landlordIdSet).filter(Boolean)
        }
        totalProperties = properties.length
        const propertyIds = properties.map((p) => p.id)
        const approvedApplications = propertyIds.length > 0
          ? await runWithRetry(() => prisma.application.findMany({
              where: { propertyId: { in: propertyIds }, status: 'APPROVED' },
              select: { tenantId: true }
            }))
          : []
        const activeLeases = landlordIds.length > 0
          ? await runWithRetry(() => prisma.lease.findMany({
              where: { landlordId: landlordIds.length === 1 ? landlordIds[0] : { in: landlordIds }, status: 'ACTIVE' },
              select: { tenantId: true }
            }))
          : []
        const tenantIdSet = new Set<string>()
        approvedApplications.forEach((a) => tenantIdSet.add(String(a.tenantId)))
        activeLeases.forEach((l) => tenantIdSet.add(String(l.tenantId)))
        activeTenants = tenantIdSet.size
        const now = new Date()
        const payments = propertyIds.length > 0
          ? await runWithRetry(() => prisma.payment.findMany({
              where: { propertyId: { in: propertyIds } }
            }))
          : []
        payments.forEach((p: any) => {
          const status = String(p.status || '').toUpperCase()
          if (status !== 'PAID' && status !== 'COMPLETED') return
          const date = new Date(p.paidAt || p.createdAt || p.updatedAt || 0)
          if (date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()) return
          const dist = p.distribution || {}
          const amount = Number(dist.landlordNet ?? p.landlordNet ?? p.amount ?? p.total ?? 0)
          monthlyRevenue += isNaN(amount) ? 0 : amount
        })
        pendingIssues = landlordIds.length > 0
          ? await runWithRetry(() => prisma.notification.count({
              where: { userId: landlordIds.length === 1 ? landlordIds[0] : { in: landlordIds }, isRead: false }
            }))
          : 0
        if (supabaseReaders.length > 0 && totalProperties === 0) {
          const sbStats = await computeSupabaseStats()
          if (sbStats.totalProperties || sbStats.activeTenants || sbStats.monthlyRevenue || sbStats.pendingIssues) {
            totalProperties = sbStats.totalProperties
            activeTenants = sbStats.activeTenants
            monthlyRevenue = sbStats.monthlyRevenue
            pendingIssues = sbStats.pendingIssues
          }
        }
      } catch (error: any) {
        console.warn('Prisma stats query failed, switching dashboard stats to fallback source:', error)
        const sbStats = await computeSupabaseStats()
        totalProperties = sbStats.totalProperties
        activeTenants = sbStats.activeTenants
        monthlyRevenue = sbStats.monthlyRevenue
        pendingIssues = sbStats.pendingIssues
      }
    } else if (region === 'china') {
      const landlordIdSet = new Set<string>(Array.from(userIds).map((id) => String(id)))
      let normalizedEmail = userEmail ? String(userEmail).toLowerCase() : ''
      if (!normalizedEmail && user.email) {
        normalizedEmail = String(user.email).toLowerCase()
      }
      try {
        if (user.email) {
          const dbUser = await db.findUserByEmail(user.email)
          if (dbUser?.id) landlordIdSet.add(String(dbUser.id))
        }
      } catch {}
      const allProperties = await db.query('properties', {})
      const properties = allProperties.filter((p: any) => {
        const ownerId = String(
          p.landlordId ||
            p.landlord_id ||
            p.ownerId ||
            p.owner_id ||
            p.userId ||
            p.user_id ||
            ''
        )
        if (ownerId && landlordIdSet.has(ownerId)) return true
        if (!normalizedEmail) return false
        const ownerEmail = String(
          p.landlordEmail ||
            p.landlord_email ||
            p.ownerEmail ||
            p.owner_email ||
            p.userEmail ||
            p.user_email ||
            ''
        ).toLowerCase()
        return ownerEmail && ownerEmail === normalizedEmail
      })
      totalProperties = properties.length
      const propertyIds = new Set(
        properties
          .map((p: any) => p.id || p._id)
          .filter(Boolean)
          .map((id: any) => String(id))
      )
      const tenantIdSet = new Set<string>()
      const applications = await db.query('applications', { status: 'APPROVED' })
      applications.forEach((a: any) => {
        const pid = String(a.propertyId || a.property_id || '')
        const landlordId = String(
          a.landlordId || a.landlord_id || a.ownerId || a.owner_id || a.userId || a.user_id || ''
        )
        if ((pid && propertyIds.has(pid)) || (landlordId && landlordIdSet.has(landlordId))) {
          const tid = a.tenantId || a.tenant_id
          if (tid) tenantIdSet.add(String(tid))
        }
      })
      const leases = await db.query('leases', { status: 'ACTIVE' })
      leases.forEach((l: any) => {
        const landlordId = String(
          l.landlordId || l.landlord_id || l.ownerId || l.owner_id || l.userId || l.user_id || ''
        )
        const pid = String(l.propertyId || l.property_id || '')
        if ((landlordId && landlordIdSet.has(landlordId)) || (pid && propertyIds.has(pid))) {
          const tid = l.tenantId || l.tenant_id
          if (tid) tenantIdSet.add(String(tid))
        }
      })
      activeTenants = tenantIdSet.size
      const payments = await db.query('payments', {})
      const now = new Date()
      payments.forEach((p: any) => {
        const pid = String(p.propertyId || p.property_id || '')
        if (!pid || !propertyIds.has(pid)) return
        const status = String(p.status || '').toUpperCase()
        if (status !== 'PAID' && status !== 'COMPLETED') return
        const date = new Date(p.paidAt || p.paid_at || p.createdAt || p.created_at || p.updatedAt || p.updated_at || 0)
        if (date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()) return
        let dist: any = p.distribution || {}
        if (typeof dist === 'string') {
          try {
            dist = JSON.parse(dist)
          } catch {
            dist = {}
          }
        }
        const amount = Number(dist.landlordNet ?? p.landlordNet ?? p.amount ?? p.total ?? 0)
        monthlyRevenue += isNaN(amount) ? 0 : amount
      })
      const notifications = await db.query('notifications', {})
      pendingIssues = notifications.filter((n: any) => {
        const uid = String(n.userId || n.user_id || '')
        const isRead = n.isRead ?? n.is_read
        return uid && landlordIdSet.has(uid) && isRead === false
      }).length
    } else if (supabaseReaders.length > 0) {
      const sbStats = await computeSupabaseStats()
      totalProperties = sbStats.totalProperties
      activeTenants = sbStats.activeTenants
      monthlyRevenue = sbStats.monthlyRevenue
      pendingIssues = sbStats.pendingIssues
    } else {
      const sbStats = await computeSupabaseStats()
      totalProperties = sbStats.totalProperties
      activeTenants = sbStats.activeTenants
      monthlyRevenue = sbStats.monthlyRevenue
      pendingIssues = sbStats.pendingIssues
    }

    if (totalProperties === 0 && activeTenants === 0 && monthlyRevenue === 0 && pendingIssues === 0) {
      try {
        const dbStats = await withTimeoutValue(
          computeDbQueryStats(),
          3500,
          { totalProperties: 0, activeTenants: 0, monthlyRevenue: 0, pendingIssues: 0 }
        )
        if (dbStats.totalProperties || dbStats.activeTenants || dbStats.monthlyRevenue || dbStats.pendingIssues) {
          totalProperties = dbStats.totalProperties
          activeTenants = dbStats.activeTenants
          monthlyRevenue = dbStats.monthlyRevenue
          pendingIssues = dbStats.pendingIssues
        }
      } catch {}
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
    if (supabaseAdmin || supabaseClient) {
      try {
        const sbStats = await computeSupabaseStats()
        return NextResponse.json({ stats: sbStats })
      } catch {}
    }
    return NextResponse.json({
      stats: {
        totalProperties: 0,
        activeTenants: 0,
        monthlyRevenue: 0,
        pendingIssues: 0
      }
    })
  }
}

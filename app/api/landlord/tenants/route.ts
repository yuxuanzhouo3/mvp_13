import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getAuthUser } from '@/lib/auth'
import { getAppRegion, getDatabaseAdapter } from '@/lib/db-adapter'
import { prisma } from '@/lib/db'
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase'

/**
 * Get tenants for landlord (approved applications and active leases)
 */
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
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const getField = (obj: any, keys: string[]) => {
      for (const key of keys) {
        const value = obj?.[key]
        if (value !== undefined && value !== null && value !== '') return value
      }
      return undefined
    }

    const region = getAppRegion()
    const db = getDatabaseAdapter()
    let resolvedUserId = user.id
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
    const supabaseReaders = [supabaseClient, supabaseAdmin].filter(Boolean) as any[]
    if (accessToken && supabaseClient) {
      try {
        const { data } = await supabaseClient.auth.getUser(accessToken)
        if (data?.user?.id) {
          tokenUserId = String(data.user.id)
        }
      } catch {}
    }
    if (!tokenUserId && accessToken && supabaseAdmin) {
      try {
        const { data } = await supabaseAdmin.auth.getUser(accessToken)
        if (data?.user?.id) {
          tokenUserId = String(data.user.id)
        }
      } catch {}
    }
    const landlordIdsForQuery: string[] = [String(resolvedUserId)]
    if (user.id && String(user.id) !== String(resolvedUserId)) {
      landlordIdsForQuery.push(String(user.id))
    }
    if (tokenUserId && !landlordIdsForQuery.includes(tokenUserId)) {
      landlordIdsForQuery.push(tokenUserId)
    }
    if (user.email && supabaseReaders.length > 0) {
      const userTables = ['User', 'user', 'users', 'Profile', 'profile', 'profiles']
      for (const client of supabaseReaders) {
        for (const tableName of userTables) {
          const { data, error } = await client
            .from(tableName)
            .select('id,email')
            .ilike('email', user.email)
            .limit(1)
          if (!error && data && data.length > 0) {
            const foundId = String(data[0].id)
            if (foundId && !landlordIdsForQuery.includes(foundId)) {
              landlordIdsForQuery.push(foundId)
            }
            break
          }
        }
        if (landlordIdsForQuery.length > 1) break
      }
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
    const effectiveDb = db

    let properties: any[] = []
    if (region === 'global' && !useSupabaseRest) {
      properties = await runWithRetry(() => prisma.property.findMany({
        where: { landlordId: landlordIdsForQuery.length === 1 ? landlordIdsForQuery[0] : { in: landlordIdsForQuery } },
        select: { id: true, title: true }
      }))
      if (properties.length === 0 && supabaseReaders.length > 0) {
        useSupabaseRest = true
      }
    }
    if (region === 'global' && useSupabaseRest) {
      if (supabaseReaders.length === 0) {
        return NextResponse.json({ tenants: [] })
      }
      const propertyTables = ['Property', 'property', 'properties', 'Listing', 'listing', 'listings']
      const landlordFields = ['landlordId', 'landlord_id', 'ownerId', 'owner_id', 'userId', 'user_id']
      const emailFields = ['landlordEmail', 'landlord_email', 'ownerEmail', 'owner_email', 'userEmail', 'user_email']
      for (const client of supabaseReaders) {
        for (const tableName of propertyTables) {
          for (const landlordField of landlordFields) {
            const { data, error } = await client
              .from(tableName)
              .select('id,title,address,landlordId,landlord_id')
              .in(landlordField, landlordIdsForQuery)
            if (!error && data) {
              properties = data.map((row: any) => ({
                id: row.id,
                title: row.title,
                address: row.address,
                landlordId: row.landlordId ?? row.landlord_id
              }))
              break
            }
          }
          if (properties.length > 0) break
        }
        if (properties.length > 0) break
      }
      if (properties.length === 0 && user.email) {
        for (const client of supabaseReaders) {
          for (const tableName of propertyTables) {
            for (const landlordField of landlordFields) {
              const { data, error } = await client
                .from(tableName)
                .select('id,title,address,landlordId,landlord_id')
                .ilike(landlordField, user.email)
              if (!error && data) {
                properties = data.map((row: any) => ({
                  id: row.id,
                  title: row.title,
                  address: row.address,
                  landlordId: row.landlordId ?? row.landlord_id
                }))
                break
              }
            }
            if (properties.length > 0) break
          }
          if (properties.length > 0) break
        }
      }
      if (properties.length === 0 && user.email) {
        for (const client of supabaseReaders) {
          for (const tableName of propertyTables) {
            for (const emailField of emailFields) {
              const { data, error } = await client
                .from(tableName)
                .select('id,title,address,landlordId,landlord_id')
                .ilike(emailField, user.email)
              if (!error && data) {
                properties = data.map((row: any) => ({
                  id: row.id,
                  title: row.title,
                  address: row.address,
                  landlordId: row.landlordId ?? row.landlord_id
                }))
                break
              }
            }
            if (properties.length > 0) break
          }
          if (properties.length > 0) break
        }
      }
    } else if (region !== 'global') {
      const allProps = await effectiveDb.query('properties', {})
      properties = allProps.filter((p: any) => landlordIdsForQuery.includes(String(p.landlordId)))
    }

    const propertyIds = properties.map(p => p.id)
    if (propertyIds.length === 0) {
      return NextResponse.json({ tenants: [] })
    }

    let approvedApplications: any[] = []
    if (region === 'global' && !useSupabaseRest) {
      approvedApplications = await runWithRetry(() => prisma.application.findMany({
        where: {
          propertyId: { in: propertyIds },
          status: 'APPROVED'
        },
        select: {
          id: true,
          tenantId: true,
          propertyId: true,
          appliedDate: true,
          monthlyIncome: true,
          creditScore: true,
          updatedAt: true
        },
        orderBy: { updatedAt: 'desc' }
      }))
    } else if (region === 'global') {
      const applicationTables = ['Application', 'application', 'applications']
      const propertyIdFields = ['propertyId', 'property_id']
      const statusFields = ['status']
      for (const client of supabaseReaders) {
        for (const tableName of applicationTables) {
          for (const propertyField of propertyIdFields) {
            for (const statusField of statusFields) {
              let query = client
                .from(tableName)
                .select('*')
                .in(propertyField, propertyIds)
                .eq(statusField, 'APPROVED')
              const { data, error } = await query
              if (!error && data) {
                approvedApplications = data.map((app: any) => ({
                  id: getField(app, ['id', '_id']),
                  tenantId: getField(app, ['tenantId', 'tenant_id']),
                  propertyId: getField(app, ['propertyId', 'property_id']),
                  appliedDate: getField(app, ['appliedDate', 'applied_date', 'createdAt', 'created_at']),
                  monthlyIncome: app.monthlyIncome ?? app.monthly_income,
                  creditScore: app.creditScore ?? app.credit_score,
                  updatedAt: getField(app, ['updatedAt', 'updated_at'])
                }))
                break
              }
            }
            if (approvedApplications.length > 0) break
          }
          if (approvedApplications.length > 0) break
        }
        if (approvedApplications.length > 0) break
      }
    } else {
      const rawApps = await effectiveDb.query('applications', { status: 'APPROVED' })
      approvedApplications = rawApps.filter((app: any) => propertyIds.includes(app.propertyId))
    }

    let activeLeases: any[] = []
    if (region === 'global' && !useSupabaseRest) {
      activeLeases = await runWithRetry(() => prisma.lease.findMany({
        where: {
          landlordId: landlordIdsForQuery.length === 1 ? landlordIdsForQuery[0] : { in: landlordIdsForQuery },
          status: 'ACTIVE'
        },
        select: {
          id: true,
          tenantId: true,
          propertyId: true,
          startDate: true,
          endDate: true,
          monthlyRent: true,
          status: true
        }
      }))
    } else if (region === 'global') {
      const leaseTables = ['Lease', 'lease', 'leases']
      const landlordFields = ['landlordId', 'landlord_id', 'ownerId', 'owner_id', 'userId', 'user_id']
      const statusFields = ['status']
      for (const client of supabaseReaders) {
        for (const tableName of leaseTables) {
          for (const landlordField of landlordFields) {
            for (const statusField of statusFields) {
              let query = client
                .from(tableName)
                .select('*')
                .in(landlordField, landlordIdsForQuery)
                .eq(statusField, 'ACTIVE')
              const { data, error } = await query
              if (!error && data) {
                activeLeases = data.map((lease: any) => ({
                  id: getField(lease, ['id', '_id']),
                  tenantId: getField(lease, ['tenantId', 'tenant_id']),
                  propertyId: getField(lease, ['propertyId', 'property_id']),
                  startDate: getField(lease, ['startDate', 'start_date']),
                  endDate: getField(lease, ['endDate', 'end_date']),
                  monthlyRent: lease.monthlyRent ?? lease.monthly_rent,
                  status: lease.status,
                  landlordId: getField(lease, ['landlordId', 'landlord_id'])
                }))
                break
              }
            }
            if (activeLeases.length > 0) break
          }
          if (activeLeases.length > 0) break
        }
        if (activeLeases.length > 0) break
      }
    } else {
      const rawLeases = await effectiveDb.query('leases', {})
      activeLeases = rawLeases.filter((lease: any) =>
        landlordIdsForQuery.includes(String(lease.landlordId)) && lease.status === 'ACTIVE'
      )
    }

    // Fetch tenant info for leases
    if (region === 'global' && useSupabaseRest && supabaseReaders.length > 0) {
      const tenantIds = Array.from(new Set(activeLeases.map((lease: any) => String(lease.tenantId || '')).filter(Boolean)))
      const propertyIdsForLeases = Array.from(new Set(activeLeases.map((lease: any) => String(lease.propertyId || '')).filter(Boolean)))
      const tenantMap = new Map<string, any>()
      const propertyMap = new Map<string, any>()
      const userTables = ['User', 'user', 'users']
      const propertyTables = ['Property', 'property', 'properties']

      if (tenantIds.length > 0) {
        for (const client of supabaseReaders) {
          for (const tableName of userTables) {
            const { data, error } = await client
              .from(tableName)
              .select('id,name,email,phone')
              .in('id', tenantIds)
            if (!error && data) {
              data.forEach((row: any) => tenantMap.set(String(row.id), row))
              break
            }
          }
          if (tenantMap.size > 0) break
        }
      }

      if (propertyIdsForLeases.length > 0) {
        for (const client of supabaseReaders) {
          for (const tableName of propertyTables) {
            const { data, error } = await client
              .from(tableName)
              .select('id,title,address')
              .in('id', propertyIdsForLeases)
            if (!error && data) {
              data.forEach((row: any) => propertyMap.set(String(row.id), row))
              break
            }
          }
          if (propertyMap.size > 0) break
        }
      }

      const tenantsFromLeases = activeLeases.map((lease: any) => {
        const tenant = tenantMap.get(String(lease.tenantId))
        if (!tenant) return null
        const property = lease.propertyId ? propertyMap.get(String(lease.propertyId)) : null
        return {
          id: tenant?.id || lease.tenantId,
          name: tenant?.name,
          email: tenant?.email,
          phone: tenant?.phone,
          propertyId: property?.id,
          propertyName: property?.title,
          propertyAddress: property?.address,
          leaseStart: lease.startDate,
          leaseEnd: lease.endDate,
          monthlyRent: lease.monthlyRent,
          status: lease.status,
        }
      }).filter(Boolean)

      const tenantsFromApplications = approvedApplications.map((app: any) => {
        const tenant = tenantMap.get(String(app.tenantId))
        if (!tenant) return null
        const property = app.propertyId ? propertyMap.get(String(app.propertyId)) : null
        return {
          id: tenant?.id || app.tenantId,
          name: tenant?.name,
          email: tenant?.email,
          phone: tenant?.phone,
          propertyId: property?.id,
          propertyName: property?.title,
          propertyAddress: property?.address,
          leaseStart: null,
          leaseEnd: null,
          monthlyRent: null,
          status: 'APPROVED'
        }
      }).filter(Boolean)

      const combined = [...tenantsFromLeases, ...tenantsFromApplications]
      const uniqueTenants = new Map<string, any>()
      for (const tenant of combined) {
        const key = `${tenant.id}-${tenant.propertyId || ''}`
        if (!uniqueTenants.has(key)) {
          uniqueTenants.set(key, tenant)
        }
      }

      return NextResponse.json({ tenants: Array.from(uniqueTenants.values()) })
    }
    const tenantsFromLeases = await Promise.all(
      activeLeases.map(async (lease) => {
        let tenant = null
        let property = null
        if (region === 'global' && !useSupabaseRest) {
          tenant = await runWithRetry(() => prisma.user.findUnique({
            where: { id: lease.tenantId },
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          }))
          if (lease.propertyId) {
            property = await runWithRetry(() => prisma.property.findUnique({
              where: { id: lease.propertyId },
              select: { id: true, title: true, address: true }
            }))
          }
        } else {
          tenant = await effectiveDb.findUserById(lease.tenantId)
          if (lease.propertyId) {
            property = await effectiveDb.findById('properties', lease.propertyId)
          }
        }
        if (!tenant) return null
        return {
          id: tenant?.id || lease.tenantId,
          name: tenant?.name,
          email: tenant?.email,
          phone: tenant?.phone,
          propertyId: property?.id,
          propertyName: property?.title,
          propertyAddress: property?.address,
          leaseStart: lease.startDate,
          leaseEnd: lease.endDate,
          monthlyRent: lease.monthlyRent,
          source: 'lease'
        }
      })
    )

    // Combine and deduplicate tenants
    let tenantsFromApplications: any[] = []
    if (region === 'global' && !useSupabaseRest) {
      tenantsFromApplications = (await Promise.all(
        approvedApplications.map(async (app) => {
          const tenant = await runWithRetry(() => prisma.user.findUnique({
            where: { id: app.tenantId },
            select: { id: true, name: true, email: true, phone: true }
          }))
          const property = app.propertyId ? await runWithRetry(() => prisma.property.findUnique({
            where: { id: app.propertyId },
            select: { id: true, title: true, address: true }
          })) : null
          if (!tenant) return null
          return {
            id: tenant?.id || app.tenantId,
            name: tenant?.name,
            email: tenant?.email,
            phone: tenant?.phone,
            propertyId: property?.id || app.propertyId,
            propertyName: property?.title,
            propertyAddress: property?.address,
            applicationDate: app.appliedDate,
            source: 'application'
          }
        })
      )).filter(Boolean)
    } else {
      tenantsFromApplications = (await Promise.all(
        approvedApplications.map(async (app: any) => {
          const tenant = await effectiveDb.findUserById(app.tenantId)
          const property = app.propertyId ? await effectiveDb.findById('properties', app.propertyId) : null
          if (!tenant) return null
          return {
            id: tenant?.id || app.tenantId,
            name: tenant?.name,
            email: tenant?.email,
            phone: tenant?.phone,
            propertyId: property?.id || app.propertyId,
            propertyName: property?.title,
            propertyAddress: property?.address,
            applicationDate: app.appliedDate,
            source: 'application'
          }
        })
      )).filter(Boolean)
    }

    // Deduplicate by tenant ID
    const tenantMap = new Map<string, any>()
    tenantsFromLeases.filter(Boolean).forEach(t => {
      const tenantId = t?.id ? String(t.id) : ''
      if (tenantId) tenantMap.set(tenantId, t)
    })
    tenantsFromApplications.filter(Boolean).forEach(t => {
      const tenantId = t?.id ? String(t.id) : ''
      if (tenantId && !tenantMap.has(tenantId)) {
        tenantMap.set(tenantId, t)
      }
    })

    const tenants = Array.from(tenantMap.values())

    return NextResponse.json({ tenants })
  } catch (error: any) {
    console.error('Get landlord tenants error:', error)
    const authHeader = request.headers.get('authorization')
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined
    const supabaseClient = createSupabaseServerClient(accessToken)
    const supabaseReaders = [supabaseClient, supabaseAdmin].filter(Boolean) as any[]
    if (supabaseReaders.length === 0) {
      return NextResponse.json({ tenants: [] })
    }
    const normalizeApplication = (app: any) => ({
      ...app,
      tenantId: app.tenantId ?? app.tenant_id,
      propertyId: app.propertyId ?? app.property_id,
      appliedDate: app.appliedDate ?? app.applied_date,
      updatedAt: app.updatedAt ?? app.updated_at,
      status: app.status ?? app.application_status,
    })
      const normalizeLease = (lease: any) => ({
        ...lease,
        tenantId: lease.tenantId ?? lease.tenant_id,
        propertyId: lease.propertyId ?? lease.property_id,
        startDate: lease.startDate ?? lease.start_date,
        endDate: lease.endDate ?? lease.end_date,
        monthlyRent: lease.monthlyRent ?? lease.monthly_rent,
        status: lease.status ?? lease.lease_status,
        landlordId: lease.landlordId ?? lease.landlord_id,
      })
      const normalizeProperty = (p: any) => ({
        ...p,
        landlordId: p.landlordId ?? p.landlord_id,
      })
      const userTables = ['User', 'user', 'users']
      const propertyTables = ['Property', 'property', 'properties']
      const applicationTables = ['Application', 'application', 'applications']
      const leaseTables = ['Lease', 'lease', 'leases']
      const tryTables = async (
        tables: string[],
        variants: Array<(client: any, tableName: string) => Promise<{ data: any; error: any }>>
      ) => {
        let lastError: any = null
        for (const client of supabaseReaders) {
          for (const tableName of tables) {
            for (const variant of variants) {
              const { data, error } = await variant(client, tableName)
              if (!error) {
                return { data }
              }
              lastError = error
            }
          }
        }
        return { data: null, error: lastError }
      }
      let tokenUserId = ''
      let tokenEmail = ''
      if (errorAuthHeader && errorAuthHeader.startsWith('Bearer ')) {
        try {
          const jwt = require('jsonwebtoken')
          const decoded = jwt.verify(
            errorAuthHeader.substring(7),
            process.env.JWT_SECRET || 'your-secret-key'
          ) as { userId: string; email: string }
          tokenUserId = decoded.userId || ''
          tokenEmail = decoded.email || ''
        } catch {}
      }
      let resolvedUserId = tokenUserId
      if (tokenEmail) {
        const { data: userRows } = await tryTables(userTables, [
          (client, tableName) =>
            client
              .from(tableName)
              .select('id,email')
              .eq('email', tokenEmail)
              .limit(1),
        ])
        const dbUser = userRows?.[0]
        if (dbUser?.id) {
          resolvedUserId = String(dbUser.id)
        }
      }
      if (!resolvedUserId) {
        return NextResponse.json({ tenants: [] })
      }
      const { data: properties } = await tryTables(propertyTables, [
        (client, tableName) =>
          client
            .from(tableName)
            .select('id,title,address,landlordId')
            .eq('landlordId', resolvedUserId),
        (client, tableName) =>
          client
            .from(tableName)
            .select('id,title,address,landlord_id')
            .eq('landlord_id', resolvedUserId),
      ])
      const normalizedProperties = (properties || []).map(normalizeProperty)
      const propertyIds = normalizedProperties.map((p: any) => p.id).filter(Boolean)
      if (propertyIds.length === 0) {
        return NextResponse.json({ tenants: [] })
      }
      const { data: approvedApplications } = await tryTables(applicationTables, [
        (client, tableName) =>
          client
            .from(tableName)
            .select('tenantId,propertyId,appliedDate,monthlyIncome,creditScore,updatedAt,status')
            .eq('status', 'APPROVED')
            .in('propertyId', propertyIds),
        (client, tableName) =>
          client
            .from(tableName)
            .select('tenant_id,property_id,applied_date,monthly_income,credit_score,updated_at,status')
            .eq('status', 'APPROVED')
            .in('property_id', propertyIds),
      ])
      const { data: activeLeases } = await tryTables(leaseTables, [
        (client, tableName) =>
          client
            .from(tableName)
            .select('tenantId,propertyId,startDate,endDate,monthlyRent,status,landlordId')
            .eq('landlordId', resolvedUserId)
            .eq('status', 'ACTIVE'),
        (client, tableName) =>
          client
            .from(tableName)
            .select('tenant_id,property_id,start_date,end_date,monthly_rent,status,landlord_id')
            .eq('landlord_id', resolvedUserId)
            .eq('status', 'ACTIVE'),
      ])
      const tenantIds = new Set<string>()
      ;(approvedApplications || []).map(normalizeApplication).forEach((app: any) => {
        if (app.tenantId) tenantIds.add(String(app.tenantId))
      })
      ;(activeLeases || []).map(normalizeLease).forEach((lease: any) => {
        if (lease.tenantId) tenantIds.add(String(lease.tenantId))
      })
      let tenantMap = new Map<string, any>()
      if (tenantIds.size > 0) {
        const { data: tenants } = await tryTables(userTables, [
          (client, tableName) =>
            client
              .from(tableName)
              .select('id,name,email,phone')
              .in('id', Array.from(tenantIds)),
        ])
        if (tenants) {
          tenantMap = new Map(tenants.map((t: any) => [String(t.id), t]))
        }
      }
      const propertyMap = new Map(
        normalizedProperties.map((p: any) => [String(p.id), p])
      )
      const tenantsFromLeases = (activeLeases || []).map(normalizeLease).map((lease: any) => {
        const tenant = tenantMap.get(String(lease.tenantId))
        const property = propertyMap.get(String(lease.propertyId))
        if (!tenant) return null
        return {
          id: tenant.id,
          name: tenant.name,
          email: tenant.email,
          phone: tenant.phone,
          propertyId: property?.id,
          propertyName: property?.title,
          propertyAddress: property?.address,
          leaseStart: lease.startDate,
          leaseEnd: lease.endDate,
          monthlyRent: lease.monthlyRent,
          source: 'lease'
        }
      }).filter(Boolean)
      const tenantsFromApplications = (approvedApplications || []).map(normalizeApplication).map((app: any) => {
        const tenant = tenantMap.get(String(app.tenantId))
        const property = propertyMap.get(String(app.propertyId))
        if (!tenant) return null
        return {
          id: tenant.id,
          name: tenant.name,
          email: tenant.email,
          phone: tenant.phone,
          propertyId: property?.id || app.propertyId,
          propertyName: property?.title,
          propertyAddress: property?.address,
          applicationDate: app.appliedDate,
          source: 'application'
        }
      }).filter(Boolean)
      const tenantMergeMap = new Map<string, any>()
      tenantsFromLeases.forEach((t: any) => {
        if (t?.id) tenantMergeMap.set(String(t.id), t)
      })
      tenantsFromApplications.forEach((t: any) => {
        if (t?.id && !tenantMergeMap.has(String(t.id))) {
          tenantMergeMap.set(String(t.id), t)
        }
      })
    return NextResponse.json({ tenants: Array.from(tenantMergeMap.values()) })
  }
}

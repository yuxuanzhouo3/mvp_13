import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'
import { prisma } from '@/lib/db'
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase'
import { trackEvent } from '@/lib/analytics'

/**
 * 创建申请
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { propertyId, monthlyIncome, creditScore, depositAmount, message } = body

    if (!propertyId) {
      return NextResponse.json(
        { error: 'Property ID is required' },
        { status: 400 }
      )
    }

    const region = process.env.NEXT_PUBLIC_APP_REGION || 'global'
    const db = getDatabaseAdapter()
    
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
    
    const property = region === 'global'
      ? await runWithRetry(() => prisma.property.findUnique({
          where: { id: propertyId },
          select: {
            id: true,
            landlordId: true,
            title: true,
            description: true,
            address: true,
            city: true,
            state: true,
            zipCode: true,
            country: true,
            latitude: true,
            longitude: true,
            price: true,
            deposit: true,
            bedrooms: true,
            bathrooms: true,
            sqft: true,
            propertyType: true,
            status: true,
            images: true,
            amenities: true,
            petFriendly: true,
            availableFrom: true,
            leaseDuration: true,
            createdAt: true,
            updatedAt: true,
          }
        }))
      : await db.findById('properties', propertyId)

    if (!property) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      )
    }

    // 检查是否已经申请过
    const allApplications = region === 'global'
      ? await runWithRetry(() => prisma.application.findMany({
          where: { tenantId: user.id, propertyId },
          select: { id: true, status: true }
        }))
      : await db.query('applications', { tenantId: user.id, propertyId })

    // Allow re-application if previous one was rejected or cancelled
    const activeApplication = allApplications.find((app: any) => 
      ['PENDING', 'APPROVED', 'AGENT_APPROVED'].includes(app.status)
    )

    if (activeApplication) {
      return NextResponse.json(
        { error: 'You have already applied for this property' },
        { status: 400 }
      )
    }

    const application = region === 'global'
      ? await runWithRetry(() => prisma.application.create({
          data: {
            tenantId: user.id,
            propertyId,
            monthlyIncome: monthlyIncome ? parseFloat(monthlyIncome) : null,
            creditScore: creditScore ? parseInt(creditScore) : null,
            depositAmount: depositAmount ? parseFloat(depositAmount) : property.deposit,
            message,
            status: 'PENDING',
            appliedDate: new Date(),
          }
        }))
      : await db.create('applications', {
          tenantId: user.id,
          propertyId,
          monthlyIncome: monthlyIncome ? parseFloat(monthlyIncome) : null,
          creditScore: creditScore ? parseInt(creditScore) : null,
          depositAmount: depositAmount ? parseFloat(depositAmount) : property.deposit,
          message,
          status: 'PENDING',
          appliedDate: new Date(),
        })

    // 加载关联数据
    const tenant = region === 'global'
      ? await runWithRetry(() => prisma.user.findUnique({
          where: { id: user.id },
          select: { id: true, name: true, email: true }
        }))
      : await db.findUserById(user.id)
    const applicationWithRelations = {
      ...application,
      property,
      tenant: tenant ? {
        id: tenant.id,
        name: tenant.name,
        email: tenant.email,
      } : null,
    }

    // 埋点
    await trackEvent({
      type: 'APPLICATION_SUBMIT',
      userId: user.id,
      metadata: { propertyId, applicationId: application.id },
    })

    return NextResponse.json({ application: applicationWithRelations })
  } catch (error: any) {
    console.error('Create application error:', error)
    return NextResponse.json(
      { error: 'Failed to create application', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * 获取申请列表
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

    const { searchParams } = new URL(request.url)
    const userType = searchParams.get('userType') // tenant 或 landlord
    const status = searchParams.get('status')

    const region = process.env.NEXT_PUBLIC_APP_REGION || 'global'
    const db = getDatabaseAdapter()
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
    const normalizeApplication = (app: any) => ({
      ...app,
      id: getField(app, ['id', '_id']),
      tenantId: getField(app, ['tenantId', 'tenant_id']),
      propertyId: getField(app, ['propertyId', 'property_id']),
      appliedDate: getField(app, ['appliedDate', 'applied_date', 'createdAt', 'created_at']),
      createdAt: getField(app, ['createdAt', 'created_at']),
      updatedAt: getField(app, ['updatedAt', 'updated_at']),
      status: app.status
    })

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
    let effectiveDb = db
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
    const isPrisma = region === 'global' && !useSupabaseRest

    const authHeader = request.headers.get('authorization')
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined
    const supabaseClient = createSupabaseServerClient(accessToken)
    const supabaseReaders = [supabaseClient, supabaseAdmin].filter(Boolean) as any[]

    let dbUser = null
    try {
      dbUser = isPrisma
        ? await runWithRetry(() => prisma.user.findUnique({
            where: { id: user.id },
            select: { id: true, userType: true, email: true }
          }))
        : await effectiveDb.findUserById(user.id)
    } catch {}
    if (!dbUser && user.email) {
      try {
        dbUser = await effectiveDb.findUserByEmail(user.email)
      } catch {}
    }
    if (!dbUser && supabaseReaders.length > 0) {
      const userTables = ['User', 'user', 'users', 'Profile', 'profile', 'profiles']
      for (const client of supabaseReaders) {
        for (const tableName of userTables) {
          if (user.id) {
            const { data, error } = await client
              .from(tableName)
              .select('id,userType,email,name,phone')
              .eq('id', user.id)
              .limit(1)
            if (!error && data && data.length > 0) {
              dbUser = data[0]
              break
            }
          }
          if (user.email) {
            const { data, error } = await client
              .from(tableName)
              .select('id,userType,email,name,phone')
              .ilike('email', user.email)
              .limit(1)
            if (!error && data && data.length > 0) {
              dbUser = data[0]
              break
            }
          }
        }
        if (dbUser) break
      }
    }
    const resolvedUserId = dbUser?.id || user.id
    const agentIdSet = new Set([String(user.id), String(resolvedUserId)])
    let tokenUserId: string | null = null
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
    const landlordIdSet = new Set<string>([String(resolvedUserId), String(user.id)])
    if (tokenUserId) landlordIdSet.add(String(tokenUserId))
    const requestedUserType = String(userType || '').toUpperCase()
    const dbUserType = String(dbUser?.userType || '').toUpperCase()
    const effectiveUserType = requestedUserType || dbUserType || String(user.userType || '').toUpperCase()

    const respondWithSupabaseApplications = async () => {
      if (supabaseReaders.length === 0) {
        return NextResponse.json({ applications: [] })
      }
      const applicationTables = ['Application', 'application', 'applications']
      const propertyTables = ['Property', 'property', 'properties', 'Listing', 'listing', 'listings']
      const landlordProfileTables = ['LandlordProfile', 'landlordProfile', 'landlord_profiles', 'landlordprofiles']
      const landlordFields = ['landlordId', 'landlord_id', 'ownerId', 'owner_id', 'userId', 'user_id']
      const agentFields = ['agentId', 'agent_id', 'brokerId', 'broker_id', 'listingAgentId', 'listing_agent_id']
      const tenantFields = ['tenantId', 'tenant_id']
      const propertyIdFields = ['propertyId', 'property_id']
      const emailFields = ['landlordEmail', 'landlord_email', 'ownerEmail', 'owner_email', 'userEmail', 'user_email']
      const landlordIds = Array.from(landlordIdSet)
      const agentIds = Array.from(agentIdSet)

      const fetchPropertyIdsByField = async (field: string, values: string[]) => {
        if (values.length === 0) return []
        for (const client of supabaseReaders) {
          for (const tableName of propertyTables) {
            const { data, error } = await client
              .from(tableName)
              .select('id')
              .in(field, values)
            if (!error && data) {
              return data.map((row: any) => row.id).filter(Boolean)
            }
          }
        }
        return []
      }
      const fetchPropertyIdsByEmail = async (email: string) => {
        for (const client of supabaseReaders) {
          for (const tableName of propertyTables) {
            for (const landlordField of landlordFields) {
              const { data, error } = await client
                .from(tableName)
                .select('id')
                .ilike(landlordField, email)
              if (!error && data) {
                const ids = data.map((row: any) => row.id).filter(Boolean)
                if (ids.length > 0) return ids
              }
            }
          }
        }
        for (const client of supabaseReaders) {
          for (const tableName of propertyTables) {
            for (const emailField of emailFields) {
              const { data, error } = await client
                .from(tableName)
                .select('id')
                .ilike(emailField, email)
              if (!error && data) {
                const ids = data.map((row: any) => row.id).filter(Boolean)
                if (ids.length > 0) return ids
              }
            }
          }
        }
        return []
      }

      let applications: any[] = []
      let propertyIds: string[] = []
      if (effectiveUserType === 'LANDLORD') {
        for (const landlordField of landlordFields) {
          propertyIds = await fetchPropertyIdsByField(landlordField, landlordIds)
          if (propertyIds.length > 0) break
        }
        if (propertyIds.length === 0 && user.email) {
          propertyIds = await fetchPropertyIdsByEmail(user.email)
        }
      } else if (effectiveUserType === 'AGENT') {
        for (const agentField of agentFields) {
          propertyIds = await fetchPropertyIdsByField(agentField, agentIds)
          if (propertyIds.length > 0) break
        }
        if (propertyIds.length === 0) {
          let representedLandlordIds: string[] = []
          for (const client of supabaseReaders) {
            for (const tableName of landlordProfileTables) {
              for (const repField of ['representedById', 'represented_by_id']) {
                const { data, error } = await client
                  .from(tableName)
                  .select('userId,user_id')
                  .in(repField, agentIds)
                if (!error && data) {
                  representedLandlordIds = data
                    .map((row: any) => row.userId ?? row.user_id)
                    .filter(Boolean)
                  break
                }
              }
              if (representedLandlordIds.length > 0) break
            }
            if (representedLandlordIds.length > 0) break
          }
          if (representedLandlordIds.length > 0) {
            for (const landlordField of landlordFields) {
              propertyIds = await fetchPropertyIdsByField(landlordField, representedLandlordIds)
              if (propertyIds.length > 0) break
            }
          }
        }
        if (propertyIds.length === 0 && user.email) {
          propertyIds = await fetchPropertyIdsByEmail(user.email)
        }
      }

      if (effectiveUserType === 'LANDLORD' || effectiveUserType === 'AGENT') {
        if (propertyIds.length === 0) {
          const directFields = effectiveUserType === 'LANDLORD' ? landlordFields : agentFields
          for (const client of supabaseReaders) {
            for (const tableName of applicationTables) {
              for (const directField of directFields) {
                let query = client
                  .from(tableName)
                  .select('*')
                  .in(directField, effectiveUserType === 'LANDLORD' ? landlordIds : agentIds)
                const { data, error } = await query
                if (!error && data) {
                  applications = data.map(normalizeApplication)
                  break
                }
              }
              if (applications.length > 0) break
            }
            if (applications.length > 0) break
          }
          if (applications.length === 0) {
            return NextResponse.json({ applications: [] })
          }
        }
        for (const client of supabaseReaders) {
          for (const tableName of applicationTables) {
            for (const propertyField of propertyIdFields) {
              let query = client
                .from(tableName)
                .select('*')
                .in(propertyField, propertyIds)
              const { data, error } = await query
              if (!error && data) {
                applications = data.map(normalizeApplication)
                break
              }
            }
            if (applications.length > 0) break
          }
          if (applications.length > 0) break
        }
      } else {
        for (const client of supabaseReaders) {
          for (const tableName of applicationTables) {
            for (const tenantField of tenantFields) {
              let query = client
                .from(tableName)
                .select('*')
                .eq(tenantField, resolvedUserId)
              const { data, error } = await query
              if (!error && data) {
                applications = data.map(normalizeApplication)
                break
              }
            }
            if (applications.length > 0) break
          }
          if (applications.length > 0) break
        }
      }

      if (status) {
        applications = applications.filter((app: any) => String(app.status || '').toUpperCase() === status.toUpperCase())
      }

      if (applications.length === 0) {
        return NextResponse.json({ applications: [] })
      }

      const propertyIdSet = new Set(applications.map((app: any) => String(app.propertyId || '')).filter(Boolean))
      const tenantIdSet = new Set(applications.map((app: any) => String(app.tenantId || '')).filter(Boolean))
      const propertyMap = new Map<string, any>()
      const tenantMap = new Map<string, any>()

      if (propertyIdSet.size > 0) {
        for (const client of supabaseReaders) {
          for (const tableName of propertyTables) {
            const { data, error } = await client
              .from(tableName)
              .select('id,title,address')
              .in('id', Array.from(propertyIdSet))
            if (!error && data) {
              data.forEach((row: any) => propertyMap.set(String(row.id), row))
              break
            }
          }
          if (propertyMap.size > 0) break
        }
      }

      if (tenantIdSet.size > 0) {
        const userTables = ['User', 'user', 'users', 'Profile', 'profile', 'profiles']
        for (const client of supabaseReaders) {
          for (const tableName of userTables) {
            const { data, error } = await client
              .from(tableName)
              .select('id,name,email,phone')
              .in('id', Array.from(tenantIdSet))
            if (!error && data) {
              data.forEach((row: any) => tenantMap.set(String(row.id), row))
              break
            }
          }
          if (tenantMap.size > 0) break
        }
      }

      const applicationsWithRelations = applications.map((app: any) => {
        const property = app.propertyId ? propertyMap.get(String(app.propertyId)) : null
        const tenant = app.tenantId ? tenantMap.get(String(app.tenantId)) : null
        return {
          ...app,
          property: property ? { id: property.id, title: property.title, address: property.address } : null,
          tenant: tenant ? { id: tenant.id, name: tenant.name, email: tenant.email, phone: tenant.phone } : null
        }
      })

      applicationsWithRelations.sort((a: any, b: any) => {
        const dateA = new Date(a.appliedDate || a.createdAt || 0).getTime()
        const dateB = new Date(b.appliedDate || b.createdAt || 0).getTime()
        return dateB - dateA
      })

      return NextResponse.json({ applications: applicationsWithRelations })
    }

    // 构建查询条件
    let applications: any[] = []
    if (isPrisma) {
      const baseWhere: any = {}
      let forceEmpty = false
      if (effectiveUserType === 'TENANT') {
        baseWhere.tenantId = resolvedUserId
      } else if (effectiveUserType === 'LANDLORD') {
        const landlordIds = Array.from(landlordIdSet)
        const landlordProperties = await runWithRetry(() => prisma.property.findMany({
          where: { landlordId: landlordIds.length === 1 ? landlordIds[0] : { in: landlordIds } },
          select: { id: true }
        }))
        const propertyIds = landlordProperties.map((p) => p.id)
        if (propertyIds.length === 0) {
          forceEmpty = true
        } else {
          baseWhere.propertyId = { in: propertyIds }
        }
      } else if (effectiveUserType === 'AGENT') {
        const agentIds = Array.from(agentIdSet)
        const representedProfiles = await runWithRetry(() => prisma.landlordProfile.findMany({
          where: { representedById: { in: agentIds } },
          select: { userId: true }
        }))
        const representedLandlordIds = representedProfiles.map((p) => p.userId)
        const orConditions: any[] = [{ agentId: { in: agentIds } }]
        if (representedLandlordIds.length > 0) {
          orConditions.push({ landlordId: { in: representedLandlordIds } })
        }
        const relatedProperties = await runWithRetry(() => prisma.property.findMany({
          where: { OR: orConditions },
          select: { id: true }
        }))
        const propertyIds = relatedProperties.map((p) => p.id)
        if (propertyIds.length === 0) {
          forceEmpty = true
        } else {
          baseWhere.propertyId = { in: propertyIds }
        }
      }
      if (status) {
        baseWhere.status = status.toUpperCase()
      }

      if (!forceEmpty && applications.length === 0 && Object.keys(baseWhere).length > 0) {
        applications = await runWithRetry(() => prisma.application.findMany({
          where: baseWhere,
          include: {
            tenant: { select: { id: true, name: true, email: true, phone: true } },
            property: { select: { id: true, title: true, address: true } }
          }
        }))
      } else if (!forceEmpty && applications.length === 0 && Object.keys(baseWhere).length === 0) {
        applications = await runWithRetry(() => prisma.application.findMany({
          include: {
            tenant: { select: { id: true, name: true, email: true, phone: true } },
            property: { select: { id: true, title: true, address: true } }
          }
        }))
      }
      if (applications.length === 0 && supabaseReaders.length > 0) {
        return await respondWithSupabaseApplications()
      }
    } else if (region === 'global') {
      return await respondWithSupabaseApplications()
    } else {
      applications = await effectiveDb.query('applications', {})
    }
    
    // 应用过滤
    if (!isPrisma) {
      if (effectiveUserType === 'TENANT') {
        applications = applications.filter((app: any) => String(getField(app, ['tenantId', 'tenant_id']) || '') === String(resolvedUserId))
      } else if (effectiveUserType === 'LANDLORD') {
        const properties = await effectiveDb.query('properties', {})
        const propertyIds = new Set(
          properties
            .filter((p: any) => landlordIdSet.has(String(getField(p, ['landlordId', 'landlord_id']) || '')))
            .map((p: any) => String(getField(p, ['id']) || ''))
            .filter(Boolean)
        )
        applications = applications.filter((app: any) => {
          const pid = String(getField(app, ['propertyId', 'property_id']) || '')
          return pid && propertyIds.has(pid)
        })
      } else if (effectiveUserType === 'AGENT') {
        const allUsers = await effectiveDb.query('users', {}, { orderBy: { createdAt: 'desc' } })
        const representedLandlordIds = new Set(
          allUsers
            .filter((u: any) => {
              const type = String(u.userType || '').toUpperCase()
              if (type !== 'LANDLORD') return false
              const repId = getRepId(u)
              return agentIdSet.has(String(repId || ''))
            })
            .map((u: any) => String(getField(u, ['id', 'userId']) || ''))
            .filter(Boolean)
        )
        const allProperties = await effectiveDb.query('properties', {}, { orderBy: { createdAt: 'desc' } })
        const propertyIds = new Set(
          allProperties
            .filter((p: any) => {
              const pid = String(getField(p, ['agentId', 'agent_id']) || '')
              const lid = String(getField(p, ['landlordId', 'landlord_id']) || '')
              return agentIdSet.has(pid) || (lid && representedLandlordIds.has(lid))
            })
            .map((p: any) => String(getField(p, ['id']) || ''))
            .filter(Boolean)
        )
        applications = applications.filter((app: any) => {
          const pid = String(getField(app, ['propertyId', 'property_id']) || '')
          return pid && propertyIds.has(pid)
        })
      }

      if (status) {
        applications = applications.filter((app: any) => app.status === status.toUpperCase())
      }
    }

    // 排序
    applications.sort((a: any, b: any) => {
      const dateA = new Date(a.appliedDate || a.createdAt).getTime()
      const dateB = new Date(b.appliedDate || b.createdAt).getTime()
      return dateB - dateA
    })

    // 加载关联数据
    if (isPrisma) {
      return NextResponse.json({ applications })
    }

    const applicationsWithRelations = await Promise.all(
      applications.map(async (app: any) => {
        const [property, tenant] = await Promise.all([
          effectiveDb.findById('properties', app.propertyId),
          effectiveDb.findUserById(app.tenantId),
        ])
        return {
          ...app,
          property,
          tenant: tenant ? {
            id: tenant.id,
            name: tenant.name,
            email: tenant.email,
            phone: tenant.phone,
          } : null,
        }
      })
    )

    return NextResponse.json({ applications: applicationsWithRelations })
  } catch (error: any) {
    console.error('Get applications error:', error)
    return NextResponse.json(
      { error: 'Failed to get applications', details: error.message },
      { status: 500 }
    )
  }
}

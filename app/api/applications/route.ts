import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { createDatabaseAdapter, getDatabaseAdapter } from '@/lib/db-adapter'
import { prisma } from '@/lib/db'
import { supabaseAdmin } from '@/lib/supabase'
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

    let useFallback = false
    let effectiveDb = db
    if (region === 'global') {
      try {
        await runWithRetry(() => prisma.user.count())
      } catch (error: any) {
        if (!isConnectionError(error)) {
          throw error
        }
        useFallback = true
        effectiveDb = createDatabaseAdapter('china')
      }
    }
    const isPrisma = region === 'global' && !useFallback

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
    const resolvedUserId = dbUser?.id || user.id
    const agentIdSet = new Set([String(user.id), String(resolvedUserId)])
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
    const landlordIdSet = new Set<string>([String(resolvedUserId), String(user.id)])
    if (tokenUserId) landlordIdSet.add(String(tokenUserId))

    // 构建查询条件
    let applications: any[] = []
    if (isPrisma) {
      const baseWhere: any = {}
      let forceEmpty = false
      if (userType === 'tenant' || dbUser?.userType === 'TENANT') {
        baseWhere.tenantId = resolvedUserId
      } else if (userType === 'landlord' || dbUser?.userType === 'LANDLORD') {
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
      } else if (userType === 'agent' || dbUser?.userType === 'AGENT') {
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
    } else {
      applications = await effectiveDb.query('applications', {})
    }
    
    // 应用过滤
    if (!isPrisma) {
      if (userType === 'tenant' || dbUser?.userType === 'TENANT') {
        applications = applications.filter((app: any) => String(getField(app, ['tenantId', 'tenant_id']) || '') === String(resolvedUserId))
      } else if (userType === 'landlord' || dbUser?.userType === 'LANDLORD') {
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
      } else if (userType === 'agent' || dbUser?.userType === 'AGENT') {
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

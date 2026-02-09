import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'
import { prisma } from '@/lib/db'
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

    let dbUser = null
    try {
      dbUser = region === 'global'
        ? await runWithRetry(() => prisma.user.findUnique({
            where: { id: user.id },
            select: { id: true, userType: true, email: true }
          }))
        : await db.findUserById(user.id)
    } catch {}
    if (!dbUser && user.email) {
      try {
        dbUser = await db.findUserByEmail(user.email)
      } catch {}
    }
    const resolvedUserId = dbUser?.id || user.id

    // 构建查询条件
    let applications: any[] = []
    if (region === 'global') {
      const baseWhere: any = {}
      if (userType === 'tenant' || dbUser?.userType === 'TENANT') {
        baseWhere.tenantId = resolvedUserId
      } else if (userType === 'landlord' || dbUser?.userType === 'LANDLORD') {
        const landlordProperties = await runWithRetry(() => prisma.property.findMany({
          where: { landlordId: resolvedUserId },
          select: { id: true }
        }))
        const propertyIds = landlordProperties.map((p) => p.id)
        if (propertyIds.length === 0) {
          applications = []
        } else {
          baseWhere.propertyId = { in: propertyIds }
        }
      }
      if (status) {
        baseWhere.status = status.toUpperCase()
      }

      if (applications.length === 0 && Object.keys(baseWhere).length > 0) {
        applications = await runWithRetry(() => prisma.application.findMany({
          where: baseWhere,
          include: {
            tenant: { select: { id: true, name: true, email: true, phone: true } },
            property: { select: { id: true, title: true, address: true } }
          }
        }))
      } else if (applications.length === 0 && Object.keys(baseWhere).length === 0) {
        applications = await runWithRetry(() => prisma.application.findMany({
          include: {
            tenant: { select: { id: true, name: true, email: true, phone: true } },
            property: { select: { id: true, title: true, address: true } }
          }
        }))
      }
    } else {
      applications = await db.query('applications', {})
    }
    
    // 应用过滤
    if (region !== 'global') {
      if (userType === 'tenant' || dbUser?.userType === 'TENANT') {
        applications = applications.filter((app: any) => app.tenantId === user.id)
      } else if (userType === 'landlord' || dbUser?.userType === 'LANDLORD') {
        const properties = await db.query('properties', { landlordId: user.id })
        const propertyIds = properties.map((p: any) => p.id)
        applications = applications.filter((app: any) => propertyIds.includes(app.propertyId))
      } else if (userType === 'agent' || dbUser?.userType === 'AGENT') {
        // 1. Get properties created by this agent
        const agentProperties = await db.query('properties', { agentId: user.id })
        
        // 2. Get properties from landlords represented by this agent
        // First, find all landlords represented by this agent
        let representedLandlordIds: string[] = []
        
        // Method A: Check users table for representedById
        try {
          // This might not work efficiently if db adapter doesn't support advanced queries, 
          // so we might need to fetch all landlords? No, that's bad.
          // Let's assume we can query users by representedById if the adapter supports it.
          // But the SupabaseAdapter implementation of query might be limited to specific collections.
          // Let's rely on api/agent/landlords logic which we know works or we can replicate.
          // Or simpler: fetch 'landlordProfiles' with representedById if available.
          
          // Let's try to find landlords where representedById == agent.id
          // Since we don't have a direct "findUsers" with filter exposed easily in generic 'query' 
          // (unless 'users' collection works), let's try 'users' or 'landlordProfiles'.
          
          // For domestic (CloudBase), 'users' collection usually works.
          // For global (Prisma), 'users' might not be queryable via 'query' method depending on implementation.
          // Let's look at db-adapter.ts again? 
          // Actually, let's just stick to what we know: 
          // If the agent created the property, agentId is set.
          // If the landlord created it, agentId might be null.
          
          // Robust approach:
          // Get all properties. (Might be heavy but safe for now given MVP scale)
          // Filter those where property.agentId == user.id OR property.landlord.representedById == user.id
          
          // Optimization: 
          // Fetch properties with agentId = user.id (we already have this: agentProperties)
          // Fetch landlords represented by user.id -> then fetch their properties.
          
          const landlords = await db.query('users', { representedById: user.id })
          representedLandlordIds = landlords.map((l: any) => l.id)
          
          // Also check LandlordProfiles if applicable
          try {
             const profiles = await db.query('landlordProfiles', { representedById: user.id })
             const profileUserIds = profiles.map((p: any) => p.userId)
             representedLandlordIds = [...new Set([...representedLandlordIds, ...profileUserIds])]
          } catch (e) {
             // Ignore if table doesn't exist
          }
        } catch (e) {
          console.warn('Failed to fetch represented landlords', e)
        }

        let landlordProperties: any[] = []
        if (representedLandlordIds.length > 0) {
          // Fetch properties for each landlord
          // Ideally: db.query('properties', { landlordId: { in: ids } })
          // But CloudBase adapter workaround for 'in' query might be needed or handled.
          // Let's do parallel requests for now or relying on the adapter to handle it if we pass an array?
          // The CloudBase workaround memory says "splitting array queries into multiple single-value queries".
          // Let's just loop.
          const promises = representedLandlordIds.map(id => db.query('properties', { landlordId: id }))
          const results = await Promise.all(promises)
          landlordProperties = results.flat()
        }

        // Merge properties
        const allProps = [...agentProperties, ...landlordProperties]
        // Deduplicate by ID
        const uniqueProps = Array.from(new Map(allProps.map(p => [p.id, p])).values())
        
        const propertyIds = uniqueProps.map((p: any) => p.id)
        applications = applications.filter((app: any) => propertyIds.includes(app.propertyId))
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
    if (region === 'global') {
      return NextResponse.json({ applications })
    }

    const applicationsWithRelations = await Promise.all(
      applications.map(async (app: any) => {
        const [property, tenant] = await Promise.all([
          db.findById('properties', app.propertyId),
          db.findUserById(app.tenantId),
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

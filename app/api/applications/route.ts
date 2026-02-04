import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'
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

    const db = getDatabaseAdapter()
    
    // 检查房源是否存在
    const property = await db.findById('properties', propertyId)

    if (!property) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      )
    }

    // 检查是否已经申请过
    const allApplications = await db.query('applications', {
      tenantId: user.id,
      propertyId
    })

    if (allApplications.length > 0) {
      return NextResponse.json(
        { error: 'You have already applied for this property' },
        { status: 400 }
      )
    }

    const application = await db.create('applications', {
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
    const tenant = await db.findUserById(user.id)
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

    const db = getDatabaseAdapter()
    const dbUser = await db.findUserById(user.id)

    // 构建查询条件
    let applications = await db.query('applications', {})
    
    // 应用过滤
    if (userType === 'tenant' || dbUser?.userType === 'TENANT') {
      applications = applications.filter((app: any) => app.tenantId === user.id)
    } else if (userType === 'landlord' || dbUser?.userType === 'LANDLORD') {
      // 需要先获取该房东的所有房源
      const properties = await db.query('properties', { landlordId: user.id })
      const propertyIds = properties.map((p: any) => p.id)
      applications = applications.filter((app: any) => propertyIds.includes(app.propertyId))
    }

    if (status) {
      applications = applications.filter((app: any) => app.status === status.toUpperCase())
    }

    // 排序
    applications.sort((a: any, b: any) => {
      const dateA = new Date(a.appliedDate || a.createdAt).getTime()
      const dateB = new Date(b.appliedDate || b.createdAt).getTime()
      return dateB - dateA
    })

    // 加载关联数据
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

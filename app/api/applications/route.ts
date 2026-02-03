import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * 创建申请
 */
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request)
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

    // 检查房源是否存在
    const property = await prisma.property.findUnique({
      where: { id: propertyId }
    })

    if (!property) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      )
    }

    // 检查是否已经申请过
    const existingApplication = await prisma.application.findFirst({
      where: {
        tenantId: user.userId,
        propertyId
      }
    })

    if (existingApplication) {
      return NextResponse.json(
        { error: 'You have already applied for this property' },
        { status: 400 }
      )
    }

    const application = await prisma.application.create({
      data: {
        tenantId: user.userId,
        propertyId,
        monthlyIncome: monthlyIncome ? parseFloat(monthlyIncome) : null,
        creditScore: creditScore ? parseInt(creditScore) : null,
        depositAmount: depositAmount ? parseFloat(depositAmount) : property.deposit,
        message
      },
      include: {
        property: true,
        tenant: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    return NextResponse.json({ application })
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
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const userType = searchParams.get('userType') // tenant 或 landlord
    const status = searchParams.get('status')

    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId }
    })

    const where: any = {}
    
    if (userType === 'tenant' || dbUser?.userType === 'TENANT') {
      where.tenantId = user.userId
    } else if (userType === 'landlord' || dbUser?.userType === 'LANDLORD') {
      where.property = {
        landlordId: user.userId
      }
    }

    if (status) {
      where.status = status.toUpperCase() as any
    }

    const applications = await prisma.application.findMany({
      where,
      include: {
        property: true,
        tenant: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            tenantProfile: true
          }
        }
      },
      orderBy: { appliedDate: 'desc' }
    })

    return NextResponse.json({ applications })
  } catch (error: any) {
    console.error('Get applications error:', error)
    return NextResponse.json(
      { error: 'Failed to get applications', details: error.message },
      { status: 500 }
    )
  }
}

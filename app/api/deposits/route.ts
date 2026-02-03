import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * 创建押金记录（需要年费会员）
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

    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId }
    })

    // 检查是否为年费会员
    if (!dbUser?.isPremium) {
      return NextResponse.json(
        { error: 'Premium membership required to use deposit protection service' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { propertyId, amount, expectedReturn } = body

    if (!propertyId || !amount) {
      return NextResponse.json(
        { error: 'Property ID and deposit amount are required' },
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

    const deposit = await prisma.deposit.create({
      data: {
        userId: user.userId,
        propertyId,
        amount: parseFloat(amount),
        expectedReturn: expectedReturn ? new Date(expectedReturn) : null,
        status: 'HELD_IN_ESCROW'
      },
      include: {
        property: true
      }
    })

    return NextResponse.json({ deposit })
  } catch (error: any) {
    console.error('Create deposit error:', error)
    return NextResponse.json(
      { error: 'Failed to create deposit', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * 获取押金列表
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
    const status = searchParams.get('status')

    const where: any = {
      OR: [
        { userId: user.userId }, // 租客的押金
        { property: { landlordId: user.userId } } // 房东的房源押金
      ]
    }

    if (status) {
      where.status = status.toUpperCase() as any
    }

    const deposits = await prisma.deposit.findMany({
      where,
      include: {
        property: {
          select: {
            id: true,
            title: true,
            address: true,
            landlord: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        dispute: true
      },
      orderBy: { depositDate: 'desc' }
    })

    return NextResponse.json({ deposits })
  } catch (error: any) {
    console.error('Get deposits error:', error)
    return NextResponse.json(
      { error: 'Failed to get deposits', details: error.message },
      { status: 500 }
    )
  }
}

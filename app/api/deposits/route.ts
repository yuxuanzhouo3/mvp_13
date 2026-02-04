import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'
import { trackEvent } from '@/lib/analytics'

/**
 * 创建押金记录（需要年费会员）
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

    const db = getDatabaseAdapter()
    const dbUser = await db.findUserById(user.id)

    // 检查是否为年费会员
    if (!dbUser?.isPremium && dbUser?.vipLevel !== 'PREMIUM' && dbUser?.vipLevel !== 'ENTERPRISE') {
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
    const property = await db.findById('properties', propertyId)

    if (!property) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      )
    }

    const deposit = await db.create('deposits', {
      userId: user.id,
      propertyId,
      amount: parseFloat(amount),
      expectedReturn: expectedReturn ? new Date(expectedReturn) : null,
      status: 'HELD_IN_ESCROW',
      depositDate: new Date(),
    })

    // 加载关联数据
    const depositWithProperty = {
      ...deposit,
      property,
    }

    // 埋点
    await trackEvent({
      type: 'DEPOSIT_CREATE',
      userId: user.id,
      metadata: { depositId: deposit.id, propertyId, amount },
    })

    return NextResponse.json({ deposit: depositWithProperty })
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
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const db = getDatabaseAdapter()
    
    // 获取所有押金
    let deposits = await db.query('deposits', {})
    
    // 获取用户相关的房源（如果是房东）
    const properties = await db.query('properties', { landlordId: user.id })
    const propertyIds = properties.map((p: any) => p.id)
    
    // 过滤：租客的押金或房东的房源押金
    deposits = deposits.filter((deposit: any) => {
      return deposit.userId === user.id || propertyIds.includes(deposit.propertyId)
    })

    // 状态过滤
    if (status) {
      deposits = deposits.filter((d: any) => d.status === status.toUpperCase())
    }

    // 排序
    deposits.sort((a: any, b: any) => {
      const dateA = new Date(a.depositDate || a.createdAt).getTime()
      const dateB = new Date(b.depositDate || b.createdAt).getTime()
      return dateB - dateA
    })

    // 加载关联数据
    const depositsWithRelations = await Promise.all(
      deposits.map(async (deposit: any) => {
        const [property, depositUser, dispute] = await Promise.all([
          db.findById('properties', deposit.propertyId),
          db.findUserById(deposit.userId),
          deposit.disputeId ? db.findById('disputes', deposit.disputeId) : null,
        ])
        
        const landlord = property ? await db.findUserById(property.landlordId) : null
        
        return {
          ...deposit,
          property: property ? {
            id: property.id,
            title: property.title,
            address: property.address,
            landlord: landlord ? {
              id: landlord.id,
              name: landlord.name,
            } : null,
          } : null,
          user: depositUser ? {
            id: depositUser.id,
            name: depositUser.name,
            email: depositUser.email,
          } : null,
          dispute: dispute || null,
        }
      })
    )

    return NextResponse.json({ deposits: depositsWithRelations })
  } catch (error: any) {
    console.error('Get deposits error:', error)
    return NextResponse.json(
      { error: 'Failed to get deposits', details: error.message },
      { status: 500 }
    )
  }
}

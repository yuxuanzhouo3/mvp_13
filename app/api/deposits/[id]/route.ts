import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'
import { trackEvent } from '@/lib/analytics'

/**
 * 获取单个押金详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const db = getDatabaseAdapter()
    const deposit = await db.findById('deposits', params.id)

    if (!deposit) {
      return NextResponse.json(
        { error: 'Deposit not found' },
        { status: 404 }
      )
    }

    // 检查权限：租客或房东可以查看
    const property = await db.findById('properties', deposit.propertyId)
    if (!property) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      )
    }

    if (deposit.userId !== user.id && property.landlordId !== user.id) {
      return NextResponse.json(
        { error: 'Not authorized to view this deposit' },
        { status: 403 }
      )
    }

    // 加载关联数据
    const [depositUser, landlord, dispute] = await Promise.all([
      db.findUserById(deposit.userId),
      db.findUserById(property.landlordId),
      deposit.disputeId ? db.findById('disputes', deposit.disputeId) : null,
    ])

    const depositWithRelations = {
      ...deposit,
      property: {
        ...property,
        landlord: landlord ? {
          id: landlord.id,
          name: landlord.name,
        } : null,
      },
      user: depositUser ? {
        id: depositUser.id,
        name: depositUser.name,
        email: depositUser.email,
      } : null,
      dispute: dispute || null,
    }

    return NextResponse.json({ deposit: depositWithRelations })
  } catch (error: any) {
    console.error('Get deposit error:', error)
    return NextResponse.json(
      { error: 'Failed to get deposit', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * 退还押金（房东操作）
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { returnAmount, deductions } = body

    const db = getDatabaseAdapter()
    const deposit = await db.findById('deposits', params.id)

    if (!deposit) {
      return NextResponse.json(
        { error: 'Deposit not found' },
        { status: 404 }
      )
    }

    // 检查权限：只有房东可以退还押金
    const property = await db.findById('properties', deposit.propertyId)
    if (!property || property.landlordId !== user.id) {
      return NextResponse.json(
        { error: 'Not authorized to return this deposit' },
        { status: 403 }
      )
    }

    // 更新押金状态
    const updatedDeposit = await db.update('deposits', params.id, {
      status: 'RETURNED',
      returnAmount: returnAmount ? parseFloat(returnAmount) : deposit.amount,
      actualReturn: new Date(),
      deductions: deductions ? JSON.stringify(deductions) : null,
    })

    // 埋点
    await trackEvent({
      type: 'DEPOSIT_CREATE',
      userId: deposit.userId,
      metadata: {
        depositId: params.id,
        action: 'returned',
        returnAmount: returnAmount || deposit.amount,
      },
    })

    return NextResponse.json({ deposit: updatedDeposit })
  } catch (error: any) {
    console.error('Return deposit error:', error)
    return NextResponse.json(
      { error: 'Failed to return deposit', details: error.message },
      { status: 500 }
    )
  }
}

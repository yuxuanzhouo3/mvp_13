import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'
import { trackEvent } from '@/lib/analytics'

/**
 * 创建争议
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
    const { depositId, reason, claim } = body

    if (!depositId || !reason) {
      return NextResponse.json(
        { error: 'Deposit ID and reason are required' },
        { status: 400 }
      )
    }

    const db = getDatabaseAdapter()
    const deposit = await db.findById('deposits', depositId)

    if (!deposit) {
      return NextResponse.json(
        { error: 'Deposit not found' },
        { status: 404 }
      )
    }

    const property = await db.findById('properties', deposit.propertyId)
    if (!property) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      )
    }

    // 检查权限（租客或房东都可以创建争议）
    if (deposit.userId !== user.id && property.landlordId !== user.id) {
      return NextResponse.json(
        { error: 'Not authorized to create this dispute' },
        { status: 403 }
      )
    }

    // 确定租客和房东ID
    const tenantId = deposit.userId
    const landlordId = property.landlordId

    const dispute = await db.create('disputes', {
      depositId,
      tenantId,
      landlordId,
      reason,
      tenantClaim: user.id === tenantId ? claim : null,
      landlordClaim: user.id === landlordId ? claim : null,
      status: 'OPEN',
    })

    // 更新押金状态
    await db.update('deposits', depositId, { status: 'DISPUTED' })

    // 加载关联数据
    const disputeWithRelations = {
      ...dispute,
      deposit: {
        ...deposit,
        property,
      },
    }

    // 埋点
    await trackEvent({
      type: 'DISPUTE_CREATE',
      userId: user.id,
      metadata: { disputeId: dispute.id, depositId },
    })

    return NextResponse.json({ dispute: disputeWithRelations })
  } catch (error: any) {
    console.error('Create dispute error:', error)
    return NextResponse.json(
      { error: 'Failed to create dispute', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * 获取争议列表
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
    let disputes = await db.query('disputes', {})

    // 过滤：租客或房东的争议
    disputes = disputes.filter((d: any) => d.tenantId === user.id || d.landlordId === user.id)

    // 状态过滤
    if (status) {
      disputes = disputes.filter((d: any) => d.status === status.toUpperCase())
    }

    // 排序
    disputes.sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt).getTime()
      const dateB = new Date(b.createdAt).getTime()
      return dateB - dateA
    })

    // 加载关联数据
    const disputesWithRelations = await Promise.all(
      disputes.map(async (dispute: any) => {
        const deposit = await db.findById('deposits', dispute.depositId)
        const property = deposit ? await db.findById('properties', deposit.propertyId) : null
        return {
          ...dispute,
          deposit: deposit ? {
            ...deposit,
            property,
          } : null,
        }
      })
    )

    return NextResponse.json({ disputes: disputesWithRelations })
  } catch (error: any) {
    console.error('Get disputes error:', error)
    return NextResponse.json(
      { error: 'Failed to get disputes', details: error.message },
      { status: 500 }
    )
  }
}

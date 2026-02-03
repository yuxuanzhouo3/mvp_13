import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * 创建争议
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
    const { depositId, reason, claim } = body

    if (!depositId || !reason) {
      return NextResponse.json(
        { error: 'Deposit ID and reason are required' },
        { status: 400 }
      )
    }

    const deposit = await prisma.deposit.findUnique({
      where: { id: depositId },
      include: {
        property: true
      }
    })

    if (!deposit) {
      return NextResponse.json(
        { error: 'Deposit not found' },
        { status: 404 }
      )
    }

    // 检查权限（租客或房东都可以创建争议）
    if (deposit.userId !== user.userId && deposit.property.landlordId !== user.userId) {
      return NextResponse.json(
        { error: 'Not authorized to create this dispute' },
        { status: 403 }
      )
    }

    // 确定租客和房东ID
    const tenantId = deposit.userId
    const landlordId = deposit.property.landlordId

    const dispute = await prisma.dispute.create({
      data: {
        depositId,
        tenantId,
        landlordId,
        reason,
        tenantClaim: user.userId === tenantId ? claim : null,
        landlordClaim: user.userId === landlordId ? claim : null,
        status: 'OPEN'
      },
      include: {
        deposit: {
          include: {
            property: true
          }
        }
      }
    })

    // 更新押金状态
    await prisma.deposit.update({
      where: { id: depositId },
      data: { status: 'DISPUTED' as any }
    })

    return NextResponse.json({ dispute })
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
        { tenantId: user.userId },
        { landlordId: user.userId }
      ]
    }

    if (status) {
      where.status = status.toUpperCase() as any
    }

    const disputes = await prisma.dispute.findMany({
      where,
      include: {
        deposit: {
          include: {
            property: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ disputes })
  } catch (error: any) {
    console.error('Get disputes error:', error)
    return NextResponse.json(
      { error: 'Failed to get disputes', details: error.message },
      { status: 500 }
    )
  }
}

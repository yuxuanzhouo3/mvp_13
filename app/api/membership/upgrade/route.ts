import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * 升级为年费会员
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
    const { paymentMethod, transactionId } = body

    // 计算会员到期时间（1年后）
    const premiumExpiry = new Date()
    premiumExpiry.setFullYear(premiumExpiry.getFullYear() + 1)

    // 更新用户为会员
    const updatedUser = await prisma.user.update({
      where: { id: user.userId },
      data: {
        isPremium: true,
        premiumExpiry
      }
    })

    // 记录支付
    await prisma.payment.create({
      data: {
        userId: user.userId,
        type: 'MEMBERSHIP' as any,
        amount: 99.99, // 年费价格
        status: 'COMPLETED' as any,
        transactionId,
        paymentMethod,
        description: 'Premium membership upgrade'
      }
    })

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        isPremium: updatedUser.isPremium,
        premiumExpiry: updatedUser.premiumExpiry
      },
      message: 'Membership upgraded successfully'
    })
  } catch (error: any) {
    console.error('Upgrade membership error:', error)
    return NextResponse.json(
      { error: 'Failed to upgrade membership', details: error.message },
      { status: 500 }
    )
  }
}

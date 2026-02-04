import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'
import { upgradeSubscription } from '@/lib/subscription-service'
import { trackSubscriptionUpgrade, trackPayment } from '@/lib/analytics'

/**
 * 升级为年费会员
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
    const { paymentMethod, transactionId, tier = 'PREMIUM', durationMonths = 12 } = body

    // 使用订阅服务升级
    const updatedUser = await upgradeSubscription(user.id, tier, durationMonths)

    // 计算金额（根据订阅级别）
    const amount = tier === 'BASIC' ? 9.99 : tier === 'PREMIUM' ? 29.99 : tier === 'ENTERPRISE' ? 99.99 : 0

    // 记录支付
    const db = getDatabaseAdapter()
    await db.create('payments', {
      userId: user.id,
      type: 'MEMBERSHIP',
      amount: amount * durationMonths,
      status: 'COMPLETED',
      transactionId,
      paymentMethod,
      description: `${tier} membership upgrade (${durationMonths} months)`,
    })

    // 埋点
    await trackPayment(user.id, amount * durationMonths, 'USD', paymentMethod, transactionId)
    await trackSubscriptionUpgrade(user.id, user.vipLevel || 'FREE', tier, amount * durationMonths)

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        isPremium: updatedUser.isPremium,
        premiumExpiry: updatedUser.premiumExpiry,
        vipLevel: updatedUser.vipLevel,
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

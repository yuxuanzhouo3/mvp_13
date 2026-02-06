import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { createPayment, createRentPayment } from '@/lib/payment-service'

/**
 * 创建支付意图（统一接口）
 * Supports both SUBSCRIPTION and RENT payments
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
    const { type = 'SUBSCRIPTION', tier, durationMonths = 12, paymentMethod, leaseId, amount } = body

    // Handle RENT payments
    if (type === 'RENT') {
        if (!leaseId) {
            return NextResponse.json({ error: 'Missing leaseId for rent payment' }, { status: 400 })
        }
        if (!amount || amount <= 0) {
            return NextResponse.json({ error: 'Invalid amount for rent payment' }, { status: 400 })
        }

        // For direct rent payment creation, we assume it's just rent (no deposit)
        // or the client should specify if it includes deposit.
        // For MVP, we assume this endpoint is for subsequent rent payments (Deposit = 0).
        // Initial payment with deposit is created via Application Approval.
        const result = await createRentPayment(user.id, leaseId, amount, 0, paymentMethod)
        
        if (!result.success) {
            return NextResponse.json(
              { error: result.error || 'Failed to create rent payment' },
              { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            paymentIntentId: result.paymentIntentId,
            clientSecret: result.clientSecret,
            paymentUrl: result.paymentUrl,
            amount: amount,
            type: 'RENT'
        })
    }

    // Handle SUBSCRIPTION payments (Legacy logic)
    if (!tier || !['BASIC', 'PREMIUM', 'ENTERPRISE'].includes(tier)) {
      return NextResponse.json(
        { error: 'Invalid subscription tier' },
        { status: 400 }
      )
    }

    // 计算金额
    const tierPrices: Record<string, number> = {
      BASIC: 9.99,
      PREMIUM: 29.99,
      ENTERPRISE: 99.99,
    }
    const unitPrice = tierPrices[tier]
    const totalAmount = unitPrice * durationMonths

    // 创建支付
    const result = await createPayment(
      user.id,
      totalAmount,
      tier,
      durationMonths,
      paymentMethod
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create payment' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      paymentIntentId: result.paymentIntentId,
      clientSecret: result.clientSecret,
      paymentUrl: result.paymentUrl,
      amount: totalAmount,
      type: 'SUBSCRIPTION'
    })
  } catch (error: any) {
    console.error('Create payment intent error:', error)
    return NextResponse.json(
      { error: 'Failed to create payment intent', details: error.message },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'
import { createAlipayOrder, createWechatPayOrder, createStripePaymentIntent } from '@/lib/payment-service'

export async function POST(
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
    const { paymentMethod } = body

    if (!paymentMethod) {
      return NextResponse.json(
        { error: 'Payment method is required' },
        { status: 400 }
      )
    }

    const db = getDatabaseAdapter()
    const payment = await db.findById('payments', params.id)

    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      )
    }

    // 验证支付属于当前用户
    if (payment.userId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // 检查支付状态
    if (payment.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Payment is not pending' },
        { status: 400 }
      )
    }

    const region = process.env.NEXT_PUBLIC_APP_REGION || 'global'
    let paymentResult

    if (region === 'china') {
      // 国内版：支付宝或微信支付
      if (paymentMethod === 'alipay') {
        paymentResult = await createAlipayOrder(
          user.id,
          payment.amount,
          payment.description || '房租支付',
          {
            paymentId: payment.id,
            ...(typeof payment.metadata === 'object' ? payment.metadata : {})
          }
        )
      } else if (paymentMethod === 'wechat') {
        paymentResult = await createWechatPayOrder(
          user.id,
          payment.amount,
          payment.description || '房租支付',
          {
            paymentId: payment.id,
            ...(typeof payment.metadata === 'object' ? payment.metadata : {})
          }
        )
      } else {
        return NextResponse.json(
          { error: 'Invalid payment method for China region' },
          { status: 400 }
        )
      }
    } else {
      // 国际版：Stripe或PayPal
      if (paymentMethod === 'stripe') {
        paymentResult = await createStripePaymentIntent(
          user.id,
          payment.amount,
          'usd',
          {
            paymentId: payment.id,
            type: payment.type || 'RENT',
            ...(typeof payment.metadata === 'object' ? payment.metadata : {})
          }
        )
      } else if (paymentMethod === 'paypal') {
        // TODO: 集成PayPal
        return NextResponse.json(
          { error: 'PayPal integration coming soon' },
          { status: 501 }
        )
      } else {
        return NextResponse.json(
          { error: 'Invalid payment method for global region' },
          { status: 400 }
        )
      }
    }

    if (!paymentResult.success) {
      console.error('Payment initiation failed:', paymentResult.error)
      return NextResponse.json(
        { 
          error: paymentResult.error || 'Failed to initiate payment',
          details: paymentResult.error?.includes('私钥') ? '请检查 .env.local 文件中的 ALIPAY_PRIVATE_KEY 配置' : undefined
        },
        { status: 500 }
      )
    }

    // 更新支付记录
    await db.update('payments', payment.id, {
      paymentMethod: paymentMethod,
      ...(paymentResult.paymentIntentId && { transactionId: paymentResult.paymentIntentId }),
      ...(paymentResult.clientSecret && { metadata: { ...(typeof payment.metadata === 'object' ? payment.metadata : {}), clientSecret: paymentResult.clientSecret } })
    })

    console.log(`[Payment Initiate] Success. Method: ${paymentMethod}, URL: ${paymentResult.paymentUrl}`)

    return NextResponse.json({
      success: true,
      paymentUrl: paymentResult.paymentUrl,
      clientSecret: paymentResult.clientSecret,
      paymentIntentId: paymentResult.paymentIntentId
    })
  } catch (error: any) {
    console.error('Initiate payment error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate payment', details: error.message },
      { status: 500 }
    )
  }
}

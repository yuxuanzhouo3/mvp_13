import { NextRequest, NextResponse } from 'next/server'
import { getAppRegion } from '@/lib/db-adapter'
import { handleStripeWebhook, handleAlipayCallback, handleWechatPayCallback } from '@/lib/payment-service'
import Stripe from 'stripe'

// 初始化 Stripe（仅国际版）
let stripe: Stripe | null = null
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-12-18.acacia',
  })
}

/**
 * Stripe Webhook（国际版）
 */
export async function POST(request: NextRequest) {
  try {
    const region = getAppRegion()

    if (region === 'global') {
      // Stripe Webhook
      if (!stripe) {
        return NextResponse.json(
          { error: 'Stripe is not configured' },
          { status: 500 }
        )
      }

      const body = await request.text()
      const signature = request.headers.get('stripe-signature')

      if (!signature) {
        return NextResponse.json(
          { error: 'Missing signature' },
          { status: 400 }
        )
      }

      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
      if (!webhookSecret) {
        return NextResponse.json(
          { error: 'Webhook secret not configured' },
          { status: 500 }
        )
      }

      let event: Stripe.Event
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
      } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message)
        return NextResponse.json(
          { error: `Webhook Error: ${err.message}` },
          { status: 400 }
        )
      }

      const result = await handleStripeWebhook(event)

      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 500 }
        )
      }

      return NextResponse.json({ received: true })
    } else {
      // 国内版：支付宝或微信支付回调
      const body = await request.json()
      const paymentMethod = body.paymentMethod || request.headers.get('x-payment-method')

      if (paymentMethod === 'alipay') {
        const result = await handleAlipayCallback(body)
        if (!result.success) {
          return NextResponse.json(
            { error: result.error },
            { status: 500 }
          )
        }
        return NextResponse.json({ success: true })
      } else if (paymentMethod === 'wechat') {
        const result = await handleWechatPayCallback(body)
        if (!result.success) {
          return NextResponse.json(
            { error: result.error },
            { status: 500 }
          )
        }
        return NextResponse.json({ success: true })
      }

      return NextResponse.json(
        { error: 'Unknown payment method' },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('Webhook handling error:', error)
    return NextResponse.json(
      { error: 'Webhook handling failed', details: error.message },
      { status: 500 }
    )
  }
}

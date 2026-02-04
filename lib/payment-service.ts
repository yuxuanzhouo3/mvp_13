/**
 * 支付服务 - 统一支付接口，支持 Stripe（国际版）和支付宝/微信（国内版）
 */

import Stripe from 'stripe'
import { getAppRegion } from './db-adapter'
import { getDatabaseAdapter } from './db-adapter'
import { upgradeSubscription } from './subscription-service'
import { trackPayment, trackSubscriptionUpgrade } from './analytics'

// 初始化 Stripe（仅国际版）
let stripe: Stripe | null = null
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-12-18.acacia',
  })
}

// 支付结果
export interface PaymentResult {
  success: boolean
  paymentIntentId?: string
  clientSecret?: string
  paymentUrl?: string // 国内支付返回的支付链接
  error?: string
}

// 创建支付意图（国际版：Stripe）
export async function createStripePaymentIntent(
  userId: string,
  amount: number,
  currency: string = 'usd',
  metadata?: Record<string, string>
): Promise<PaymentResult> {
  if (!stripe) {
    return { success: false, error: 'Stripe is not configured' }
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // 转换为分
      currency,
      metadata: {
        userId,
        ...metadata,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    })

    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret || undefined,
    }
  } catch (error: any) {
    console.error('Stripe payment intent creation error:', error)
    return { success: false, error: error.message }
  }
}

// 创建支付宝订单（国内版）
export async function createAlipayOrder(
  userId: string,
  amount: number,
  subject: string,
  metadata?: Record<string, string>
): Promise<PaymentResult> {
  // TODO: 集成支付宝 SDK
  // 这里需要根据实际的支付宝 SDK 实现
  // 示例：使用 alipay-sdk
  
  try {
    // 创建订单记录
    const db = getDatabaseAdapter()
    const payment = await db.create('payments', {
      userId,
      type: 'MEMBERSHIP',
      amount,
      status: 'PENDING',
      paymentMethod: 'alipay',
      description: subject,
    })

    // TODO: 调用支付宝 API 创建订单
    // const alipayOrder = await alipaySdk.createOrder({...})
    
    // 返回支付链接（实际应该从支付宝 API 获取）
    return {
      success: true,
      paymentUrl: `https://openapi.alipay.com/gateway.do?order_id=${payment.id}`, // 示例
    }
  } catch (error: any) {
    console.error('Alipay order creation error:', error)
    return { success: false, error: error.message }
  }
}

// 创建微信支付订单（国内版）
export async function createWechatPayOrder(
  userId: string,
  amount: number,
  description: string,
  metadata?: Record<string, string>
): Promise<PaymentResult> {
  // TODO: 集成微信支付 SDK
  // 这里需要根据实际的微信支付 SDK 实现
  
  try {
    // 创建订单记录
    const db = getDatabaseAdapter()
    const payment = await db.create('payments', {
      userId,
      type: 'MEMBERSHIP',
      amount,
      status: 'PENDING',
      paymentMethod: 'wechat',
      description,
    })

    // TODO: 调用微信支付 API 创建订单
    // const wechatOrder = await wechatPaySdk.createOrder({...})
    
    // 返回支付参数（实际应该从微信支付 API 获取）
    return {
      success: true,
      paymentUrl: `weixin://wxpay/bizpayurl?pr=${payment.id}`, // 示例
    }
  } catch (error: any) {
    console.error('Wechat Pay order creation error:', error)
    return { success: false, error: error.message }
  }
}

// 统一的创建支付接口
export async function createPayment(
  userId: string,
  amount: number,
  tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE',
  durationMonths: number = 12,
  paymentMethod?: 'stripe' | 'alipay' | 'wechat'
): Promise<PaymentResult> {
  const region = getAppRegion()
  const currency = region === 'china' ? 'CNY' : 'USD'
  
  // 计算金额
  const tierPrices: Record<string, number> = {
    BASIC: 9.99,
    PREMIUM: 29.99,
    ENTERPRISE: 99.99,
  }
  const unitPrice = tierPrices[tier] || 29.99
  const totalAmount = unitPrice * durationMonths

  if (region === 'global') {
    // 国际版：使用 Stripe
    const method = paymentMethod || 'stripe'
    if (method === 'stripe') {
      return await createStripePaymentIntent(userId, totalAmount, 'usd', {
        tier,
        durationMonths: durationMonths.toString(),
      })
    }
    // TODO: 支持 PayPal
    return { success: false, error: 'Payment method not supported' }
  } else {
    // 国内版：使用支付宝或微信
    const method = paymentMethod || 'alipay'
    const subject = `${tier} 会员订阅 (${durationMonths}个月)`
    
    if (method === 'alipay') {
      return await createAlipayOrder(userId, totalAmount, subject, {
        tier,
        durationMonths: durationMonths.toString(),
      })
    } else if (method === 'wechat') {
      return await createWechatPayOrder(userId, totalAmount, subject, {
        tier,
        durationMonths: durationMonths.toString(),
      })
    }
    
    return { success: false, error: 'Payment method not supported' }
  }
}

// 处理 Stripe Webhook
export async function handleStripeWebhook(
  event: Stripe.Event
): Promise<{ success: boolean; error?: string }> {
  if (!stripe) {
    return { success: false, error: 'Stripe is not configured' }
  }

  try {
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      const userId = paymentIntent.metadata.userId
      const tier = paymentIntent.metadata.tier as 'BASIC' | 'PREMIUM' | 'ENTERPRISE'
      const durationMonths = parseInt(paymentIntent.metadata.durationMonths || '12')

      if (!userId || !tier) {
        return { success: false, error: 'Missing metadata' }
      }

      // 升级订阅
      await upgradeSubscription(userId, tier, durationMonths)

      // 更新支付记录
      const db = getDatabaseAdapter()
      const payments = await db.query('payments', {
        userId,
        status: 'PENDING',
      })
      
      const payment = payments.find((p: any) => 
        p.transactionId === paymentIntent.id || 
        p.description?.includes(tier)
      )

      if (payment) {
        await db.update('payments', payment.id, {
          status: 'COMPLETED',
          transactionId: paymentIntent.id,
        })
      } else {
        // 创建新的支付记录
        await db.create('payments', {
          userId,
          type: 'MEMBERSHIP',
          amount: paymentIntent.amount / 100,
          status: 'COMPLETED',
          transactionId: paymentIntent.id,
          paymentMethod: 'stripe',
          description: `${tier} membership (${durationMonths} months)`,
        })
      }

      // 埋点
      await trackPayment(
        userId,
        paymentIntent.amount / 100,
        paymentIntent.currency.toUpperCase(),
        'stripe',
        paymentIntent.id
      )
      await trackSubscriptionUpgrade(userId, 'FREE', tier, paymentIntent.amount / 100)

      return { success: true }
    }

    return { success: true } // 其他事件类型忽略
  } catch (error: any) {
    console.error('Stripe webhook handling error:', error)
    return { success: false, error: error.message }
  }
}

// 处理支付宝回调
export async function handleAlipayCallback(
  params: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  // TODO: 验证支付宝签名
  // TODO: 处理支付成功逻辑
  
  try {
    const { out_trade_no, trade_no, trade_status } = params

    if (trade_status !== 'TRADE_SUCCESS') {
      return { success: false, error: 'Payment not completed' }
    }

    // 从订单号中提取用户信息（需要根据实际实现调整）
    const db = getDatabaseAdapter()
    const payment = await db.findById('payments', out_trade_no)
    
    if (!payment) {
      return { success: false, error: 'Payment not found' }
    }

    // 升级订阅
    const tier = 'PREMIUM' // 从支付记录中获取
    await upgradeSubscription(payment.userId, tier, 12)

    // 更新支付记录
    await db.update('payments', payment.id, {
      status: 'COMPLETED',
      transactionId: trade_no,
    })

    // 埋点
    await trackPayment(payment.userId, payment.amount, 'CNY', 'alipay', trade_no)

    return { success: true }
  } catch (error: any) {
    console.error('Alipay callback handling error:', error)
    return { success: false, error: error.message }
  }
}

// 处理微信支付回调
export async function handleWechatPayCallback(
  data: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  // TODO: 验证微信支付签名
  // TODO: 处理支付成功逻辑
  
  try {
    const { out_trade_no, transaction_id, return_code } = data

    if (return_code !== 'SUCCESS') {
      return { success: false, error: 'Payment not completed' }
    }

    // 从订单号中提取用户信息
    const db = getDatabaseAdapter()
    const payment = await db.findById('payments', out_trade_no)
    
    if (!payment) {
      return { success: false, error: 'Payment not found' }
    }

    // 升级订阅
    const tier = 'PREMIUM' // 从支付记录中获取
    await upgradeSubscription(payment.userId, tier, 12)

    // 更新支付记录
    await db.update('payments', payment.id, {
      status: 'COMPLETED',
      transactionId: transaction_id,
    })

    // 埋点
    await trackPayment(payment.userId, payment.amount, 'CNY', 'wechat', transaction_id)

    return { success: true }
  } catch (error: any) {
    console.error('Wechat Pay callback handling error:', error)
    return { success: false, error: error.message }
  }
}

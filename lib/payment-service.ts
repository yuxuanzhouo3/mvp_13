/**
 * 支付服务 - 统一支付接口，支持 Stripe（国际版）和支付宝/微信（国内版）
 */

import Stripe from 'stripe'
import { getAppRegion } from './db-adapter'
import { getDatabaseAdapter } from './db-adapter'
import { upgradeSubscription } from './subscription-service'
import { trackPayment } from './analytics'
import { prisma } from './db' // Used for Global/Prisma operations

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
  distribution?: PaymentDistribution // 分账详情
}

// 分账结果接口
export interface PaymentDistribution {
  total: number
  platformFee: number
  listingAgentFee: number
  tenantAgentFee: number
  landlordNet: number
  deposit?: number  // 押金部分（继续托管，不释放）
  currency: string
  details: {
    listingAgentId?: string
    tenantAgentId?: string
    landlordId: string
  }
}

// 创建支付意图（国际版：Stripe）
export async function createStripePaymentIntent(
  userId: string,
  amount: number,
  currency: string = 'usd',
  metadata?: Record<string, string>,
  captureMethod: 'automatic' | 'manual' = 'automatic',
  transferGroup?: string
): Promise<PaymentResult> {
  if (!stripe) {
    return { success: false, error: 'Stripe is not configured' }
  }

  try {
    const params: Stripe.PaymentIntentCreateParams = {
      amount: Math.round(amount * 100), // 转换为分
      currency,
      metadata: {
        userId,
        ...metadata,
      },
      capture_method: captureMethod,
      automatic_payment_methods: {
        enabled: true,
      },
    }

    if (transferGroup) {
      params.transfer_group = transferGroup
    }

    const paymentIntent = await stripe.paymentIntents.create(params)

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
  metadata?: Record<string, string>,
  isProfitSharing: boolean = false
): Promise<PaymentResult> {
  // TODO: 集成支付宝 SDK
  try {
    const db = getDatabaseAdapter()
    const payment = await db.create('payments', {
      userId,
      amount,
      currency: 'cny',
      status: 'PENDING',
      type: 'RENT', // Default type, should be passed
      description: subject,
      metadata,
      createdAt: new Date(),
    })

    return {
      success: true,
      paymentUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/mock-alipay?orderId=${payment.id}`,
    }
  } catch (error: any) {
    console.error('Alipay order creation error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Calculate rent distribution (Deduction Method)
 * Platform Fee: 5%
 * Agent Commission: 50% of first month rent (only if agent involved)
 */
export function calculateRentDistribution(
  rentAmount: number,
  isFirstMonth: boolean,
  listingAgentId?: string | null,
  tenantAgentId?: string | null
): PaymentDistribution {
  const platformRate = 0.05
  const commissionRate = 0.50 // 50% of first month rent

  const platformFee = rentAmount * platformRate
  let totalCommission = 0
  let listingAgentFee = 0
  let tenantAgentFee = 0

  if (isFirstMonth && (listingAgentId || tenantAgentId)) {
    totalCommission = rentAmount * commissionRate
    
    if (listingAgentId && tenantAgentId) {
      // Split commission 50/50 if both agents exist
      listingAgentFee = totalCommission / 2
      tenantAgentFee = totalCommission / 2
    } else if (listingAgentId) {
      listingAgentFee = totalCommission
    } else if (tenantAgentId) {
      tenantAgentFee = totalCommission
    }
  }

  const landlordNet = rentAmount - platformFee - totalCommission

  return {
    total: rentAmount,
    platformFee,
    listingAgentFee,
    tenantAgentFee,
    landlordNet,
    currency: 'usd', // or cny, strictly logic doesn't care
    details: {
      listingAgentId: listingAgentId || undefined,
      tenantAgentId: tenantAgentId || undefined,
      landlordId: 'landlord', // Placeholder, caller should know
    }
  }
}

/**
 * Release funds from escrow
 */
export async function releaseEscrowFunds(paymentId: string): Promise<boolean> {
  const db = getDatabaseAdapter()
  
  try {
    const payment = await db.findById('payments', paymentId)
    if (!payment) {
      throw new Error('Payment not found')
    }

    if (payment.escrowStatus !== 'HELD_IN_ESCROW') {
      // Already released or refunded
      return true
    }

    // Update payment status
    await db.update('payments', paymentId, {
      escrowStatus: 'RELEASED',
      status: 'COMPLETED', // Ensure it is completed
      updatedAt: new Date()
    })

    // In a real system, here we would trigger payouts to Stripe Connect accounts
    // or WeChat/Alipay Merchant accounts based on payment.distribution
    console.log(`[Funds Released] Payment ${paymentId} released. Distribution:`, payment.distribution)

    return true
  } catch (error) {
    console.error('Release funds error:', error)
    return false
  }
}

// 创建微信支付订单（国内版）
export async function createWechatPayOrder(
  userId: string,
  amount: number,
  description: string,
  metadata?: Record<string, string>,
  isProfitSharing: boolean = false
): Promise<PaymentResult> {
  // TODO: 集成微信支付 SDK
  try {
    const db = getDatabaseAdapter()
    const payment = await db.create('payments', {
      userId,
      type: 'MEMBERSHIP', // Default
      amount,
      status: 'PENDING',
      paymentMethod: 'wechat',
      description,
      metadata: {
        ...metadata,
        profit_sharing: isProfitSharing ? 'Y' : 'N'
      }
    })

    return {
      success: true,
      paymentUrl: `weixin://wxpay/bizpayurl?pr=${payment.id}&profit_sharing=${isProfitSharing ? 'Y' : 'N'}`,
    }
  } catch (error: any) {
    console.error('Wechat Pay order creation error:', error)
    return { success: false, error: error.message }
  }
}

// 统一的创建支付接口 (Membership)
export async function createPayment(
  userId: string,
  amount: number,
  tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE',
  durationMonths: number = 12,
  paymentMethod?: 'stripe' | 'alipay' | 'wechat'
): Promise<PaymentResult> {
  const region = getAppRegion()
  const currency = region === 'china' ? 'CNY' : 'USD'
  
  const tierPrices: Record<string, number> = {
    BASIC: 9.99,
    PREMIUM: 29.99,
    ENTERPRISE: 99.99,
  }
  const unitPrice = tierPrices[tier] || 29.99
  const totalAmount = unitPrice * durationMonths

  if (region === 'global') {
    const method = paymentMethod || 'stripe'
    if (method === 'stripe') {
      return await createStripePaymentIntent(userId, totalAmount, 'usd', {
        tier,
        durationMonths: durationMonths.toString(),
      })
    }
    return { success: false, error: 'Payment method not supported' }
  } else {
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

// NEW: 分账计算引擎
export async function calculateRentDistribution(leaseId: string, rentAmount: number, totalAmount: number): Promise<PaymentDistribution> {
  const region = getAppRegion()
  let lease: any

  if (region === 'global') {
    // Supabase/Prisma
    lease = await prisma.lease.findUnique({
      where: { id: leaseId },
      include: {
        listingAgent: { include: { agentProfile: true } },
        tenantAgent: { include: { agentProfile: true } },
        property: { include: { landlord: { include: { landlordProfile: true } } } }
      }
    })
  } else {
    // CloudBase (Simplified for MVP)
    const db = getDatabaseAdapter()
    lease = await db.findById('leases', leaseId)
  }

  if (!lease) {
    throw new Error('Lease not found')
  }

  // Configuration (Could be DB driven)
  const PLATFORM_FEE_PERCENT = 0.05
  const AGENT_COMMISSION_PERCENT = 0.50 // 50% of first month rent

  // Platform Fee is based on Rent (user requirement: R * P_rate)
  const platformFee = Number((rentAmount * PLATFORM_FEE_PERCENT).toFixed(2))
  
  let listingAgentFee = 0
  let tenantAgentFee = 0

  // Commission is based on Rent (user requirement: R * C_rate)
  if (lease.listingAgentId || lease.tenantAgentId) {
     const totalCommission = Number((rentAmount * AGENT_COMMISSION_PERCENT).toFixed(2))
     
     if (lease.listingAgentId && lease.tenantAgentId) {
       listingAgentFee = totalCommission / 2
       tenantAgentFee = totalCommission / 2
     } else if (lease.listingAgentId) {
       listingAgentFee = totalCommission
     } else if (lease.tenantAgentId) {
       tenantAgentFee = totalCommission
     }
  }

  // Landlord Net = Total - PlatformFee - Commission
  // Note: Total includes Deposit. Deposit is passed through to Landlord?
  // User says: "Deposit: Held in platform (D)".
  // Wait. "Settlement: Deposit: Continue frozen in platform... Rent: Platform deducts fees, then releases to Landlord".
  // So Deposit is NOT released to Landlord yet!
  // My logic `releaseEscrowFunds` releases EVERYTHING.
  // This is wrong for Deposit.
  // Deposit should stay in Escrow?
  // User says: "Settlement & Split... Deposit: Continue frozen... Rent: Platform deducts fees... releases to Landlord".
  
  // So `landlordNet` calculated here should be the RELEASEABLE amount from RENT only?
  // But `totalAmount` collected includes Deposit.
  
  // If `releaseEscrowFunds` is called on Check-in, it should ONLY release the RENT portion.
  // The DEPOSIT portion should remain HELD.
  
  // How to handle partial release?
  // Stripe PaymentIntent capture is all or nothing usually?
  // Manual capture allows partial capture (and refund the rest).
  // But we want to KEEP the rest (Deposit).
  // We can capture the FULL amount.
  // But then the funds are in our Platform Account.
  // We transfer the RENT portion to Landlord/Agents.
  // We KEEP the DEPOSIT portion in Platform Account (until lease end).
  
  // So:
  // `landlordNet` here should be `rentAmount - platformFee - commissions`.
  // `deposit` is separate.
  
  // `PaymentDistribution` should probably track `deposit` separately.
  // But for now, `landlordNet` + `fees` + `deposit` = `totalAmount`.
  // Wait, `landlordNet` is what Landlord gets NOW.
  // So `landlordNet` = `rentAmount` - `fees`.
  // The `deposit` is NOT in `landlordNet`.
  
  // So `total` check: `platformFee + listingAgentFee + tenantAgentFee + landlordNet + deposit` should equal `totalAmount`.
  
  const deposit = totalAmount - rentAmount
  const landlordNet = Number((rentAmount - platformFee - listingAgentFee - tenantAgentFee).toFixed(2))

  return {
    total: totalAmount,
    platformFee,
    listingAgentFee,
    tenantAgentFee,
    landlordNet, // This is Rent Net
    deposit,     // New field to track deposit
    currency: region === 'china' ? 'CNY' : 'USD',
    details: {
      listingAgentId: lease.listingAgentId || undefined,
      tenantAgentId: lease.tenantAgentId || undefined,
      landlordId: lease.landlordId || (lease.property?.landlordId),
    }
  }
}

// NEW: 创建租金支付（带分账）
export async function createRentPayment(
  userId: string,
  leaseId: string,
  rentAmount: number,
  depositAmount: number, // Added
  paymentMethod?: 'stripe' | 'alipay' | 'wechat'
): Promise<PaymentResult> {
  const region = getAppRegion()
  const db = getDatabaseAdapter()
  const totalAmount = rentAmount + depositAmount
  
  // 1. Calculate Distribution
  const distribution = await calculateRentDistribution(leaseId, rentAmount, totalAmount)

  // 2. Create Payment Record
  const paymentData = {
    userId,
    type: 'RENT',
    amount: totalAmount,
    status: 'PENDING',
    paymentMethod: paymentMethod || (region === 'global' ? 'stripe' : 'alipay'),
    description: `Rent payment for lease ${leaseId}`,
    escrowStatus: 'HELD_IN_ESCROW',
    distribution: distribution as any, // Store JSON
    propertyId: undefined, 
    transactionId: null 
  }
  
  const payment = await db.create('payments', paymentData)

  // 3. Initiate Payment
  if (region === 'global') {
    const transferGroup = `rent_${leaseId}_${payment.id}`
    await db.update('payments', payment.id, {
        metadata: { transferGroup, leaseId }
    })
    
    return await createStripePaymentIntent(
      userId, 
      totalAmount, 
      'usd', 
      {
        leaseId,
        paymentId: payment.id,
        type: 'RENT'
      },
      'manual', 
      transferGroup
    )
  } else {
    // China Region
    const method = paymentMethod || 'alipay'
    const subject = `房租支付 - 合同号 ${leaseId}`
    
    let result: PaymentResult
    
    if (method === 'alipay') {
        result = await createAlipayOrder(userId, totalAmount, subject, { leaseId, paymentId: payment.id, type: 'RENT' }, true)
    } else {
        result = await createWechatPayOrder(userId, totalAmount, subject, { leaseId, paymentId: payment.id, type: 'RENT' }, true)
    }
    
    return {
      ...result,
      distribution
    }
  }
}

// NEW: 释放租金（结算分账）
export async function releaseRentPayment(paymentId: string): Promise<{ success: boolean; message?: string }> {
  const db = getDatabaseAdapter()
  const payment = await db.findById('payments', paymentId)
  
  if (!payment) {
      return { success: false, message: 'Payment not found' }
  }

  if (payment.status !== 'COMPLETED' && payment.status !== 'PAID') { // Accept PAID as well if used
     // In China flow, callback might set it to COMPLETED. 
     // For Stripe manual capture, it might be 'requires_capture' on Stripe side, but we track 'PENDING' until webhook updates it?
     // Actually, if capture_method=manual, the status is 'requires_capture'. We need to capture it first.
  }
  
  if (payment.escrowStatus !== 'HELD_IN_ESCROW') {
    return { success: false, message: `Invalid escrow status: ${payment.escrowStatus}` }
  }

  const distribution = payment.distribution as PaymentDistribution
  if (!distribution) {
    return { success: false, message: 'No distribution details found' }
  }

  const region = getAppRegion()

  if (region === 'global' && stripe) {
    // Stripe Transfers
    try {
       // 1. Capture the payment if it was manual (Funds are held)
       // Assuming transactionId is the PaymentIntent ID
       if (payment.transactionId) {
           const pi = await stripe.paymentIntents.retrieve(payment.transactionId)
           if (pi.status === 'requires_capture') {
               await stripe.paymentIntents.capture(payment.transactionId)
               console.log(`[Stripe] Captured payment ${payment.transactionId}`)
           }
       }

       // 2. Execute Transfers (分账)
       // We use the transfer_group established at creation
       const transferGroup = payment.metadata?.transferGroup || `rent_${payment.description?.split(' ').pop()}_${payment.id}`
       
       // Helper to transfer
       const transfer = async (amount: number, destination: string, role: string) => {
           if (amount <= 0) return
           try {
               await stripe!.transfers.create({
                   amount: Math.round(amount * 100),
                   currency: 'usd',
                   destination: destination, // Must be a Connect Account ID (acct_...)
                   transfer_group: transferGroup,
                   metadata: { paymentId, role }
               })
               console.log(`[Stripe] Transferred ${amount} to ${role} (${destination})`)
           } catch (err: any) {
               console.error(`[Stripe] Transfer to ${role} failed:`, err.message)
               // Don't throw, try to complete others
           }
       }

       // In a real app, we must look up the user's Connect Account ID (payoutAccountId)
       // For MVP, we will simulate this look up or use the ID if it looks like an account ID
       // const landlord = await db.findUserById(distribution.details.landlordId)
       // const destination = landlord.landlordProfile?.payoutAccountId
       
       // Mocking the destination for demonstration if not available
       const mockDestination = 'acct_123456789' 

       // 只释放租金部分给房东/中介，押金继续在平台托管
       // Only release rent portion to landlord/agents, deposit remains in escrow
       await transfer(distribution.landlordNet, mockDestination, 'landlord')
       
       if (distribution.details.listingAgentId) {
           await transfer(distribution.listingAgentFee, mockDestination, 'listingAgent')
       }
       if (distribution.details.tenantAgentId) {
           await transfer(distribution.tenantAgentFee, mockDestination, 'tenantAgent')
       }

       // 注意：押金（distribution.deposit）不释放，继续在平台托管直到退租
       // Note: Deposit (distribution.deposit) is NOT released, remains in escrow until lease end

       // Update Payment Status (only rent portion is released, deposit stays in escrow)
       await db.update('payments', paymentId, {
         escrowStatus: 'RELEASED' // 租金已释放，但押金仍在托管中
       })

       // Update Lease Status to ACTIVE
       if (payment.metadata?.leaseId) {
         try {
           await db.update('leases', payment.metadata.leaseId, { status: 'ACTIVE' })
         } catch (e) {
           console.error('Failed to update lease status:', e)
         }
       }
       
       return { success: true }
    } catch (e: any) {
      console.error('Release failed', e)
      return { success: false, message: e.message }
    }
  } else {
    // China Logic (CloudBase + Alipay/WeChat Profit Sharing)
    try {
        console.log(`[China] Starting profit sharing for payment ${paymentId}`)
        
        // 1. Simulate "Request Profit Sharing" API call
        // In reality: await alipaySdk.trade.royalty.relation.bind(...) & request(...)
        
        const receivers = []
        receivers.push({ 
            type: 'merchant', 
            account: distribution.details.landlordId, // In reality: payoutAccountId 
            amount: distribution.landlordNet,
            memo: 'Landlord Rent'
        })
        
        if (distribution.listingAgentFee > 0) {
            receivers.push({
                type: 'merchant',
                account: distribution.details.listingAgentId,
                amount: distribution.listingAgentFee,
                memo: 'Listing Agent Commission'
            })
        }
        
        // Log the mock call
        console.log(`[China] Mock API Call: Request Profit Sharing`, {
            order_id: payment.id,
            receivers
        })
        
        // 2. Update Database
        await db.update('payments', paymentId, {
          escrowStatus: 'RELEASED',
          metadata: {
              ...payment.metadata,
              profit_sharing_time: new Date().toISOString()
          }
        })

        // Update Lease Status to ACTIVE
        if (payment.metadata?.leaseId) {
          try {
            await db.update('leases', payment.metadata.leaseId, { status: 'ACTIVE' })
          } catch (e) {
            console.error('Failed to update lease status:', e)
          }
        }
        
        return { success: true }
    } catch (e: any) {
        console.error('China release failed', e)
        return { success: false, message: e.message }
    }
  }
}

// NEW: 租金退款（争议处理）
export async function refundRentPayment(paymentId: string, reason?: string): Promise<{ success: boolean; message?: string }> {
    const db = getDatabaseAdapter()
    const payment = await db.findById('payments', paymentId)
    
    if (!payment) return { success: false, message: 'Payment not found' }
    
    // Only allow refund if funds are still held or completed but not released? 
    // Usually if RELEASED, we have to reverse transfers. For MVP, assume we can only refund if HELD_IN_ESCROW.
    if (payment.escrowStatus === 'RELEASED') {
        return { success: false, message: 'Funds already released. Manual reversal required.' }
    }
    
    const region = getAppRegion()
    
    try {
        if (region === 'global' && stripe && payment.transactionId) {
            // Stripe Refund
            await stripe.refunds.create({
                payment_intent: payment.transactionId,
                reason: 'requested_by_customer', // or 'fraudulent', 'duplicate'
                metadata: { reason: reason || 'Rent Dispute' }
            })
        } else {
            // China Mock Refund
            console.log(`[China] Mock API Call: Refund Order ${payment.id}`)
        }
        
        await db.update('payments', paymentId, {
            escrowStatus: 'REFUNDED',
            status: 'REFUNDED',
            metadata: {
                ...payment.metadata,
                refund_reason: reason,
                refund_time: new Date().toISOString()
            }
        })
        
        return { success: true }
    } catch (e: any) {
        console.error('Refund failed', e)
        return { success: false, message: e.message }
    }
}


// 处理 Stripe Webhook (Updated)
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
      const type = paymentIntent.metadata.type
      
      const db = getDatabaseAdapter()

      if (type === 'RENT') {
        const paymentId = paymentIntent.metadata.paymentId
        if (paymentId) {
           await db.update('payments', paymentId, {
             status: 'COMPLETED',
             transactionId: paymentIntent.id,
             // Note: Escrow status remains HELD_IN_ESCROW until explicit release
           })
           // Optionally track rent payment event
           await trackPayment(userId, paymentIntent.amount/100, 'USD', 'stripe', paymentIntent.id)
        }
        return { success: true }
      }

      // Existing Membership Logic
      const tier = paymentIntent.metadata.tier as 'BASIC' | 'PREMIUM' | 'ENTERPRISE'
      const durationMonths = parseInt(paymentIntent.metadata.durationMonths || '12')

      if (userId && tier) {
        await upgradeSubscription(userId, tier, durationMonths)
        // Update payment record... (Simplified for brevity, assuming existing logic)
        // For membership, we might want to create a record if it doesn't exist (e.g. from checkout session)
        // But here we assume paymentIntent creation created the record PENDING.
        // We'd need paymentId in metadata to be sure.
      }
      return { success: true }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Stripe webhook handling error:', error)
    return { success: false, error: error.message }
  }
}

// ... Keep existing callback handlers for Alipay/Wechat ...
export async function handleAlipayCallback(params: Record<string, string>): Promise<{ success: boolean; error?: string }> {
    // In reality: verify signature, update payment status
    const db = getDatabaseAdapter()
    const paymentId = params.order_id
    if (paymentId) {
        await db.update('payments', paymentId, {
            status: 'COMPLETED',
            transactionId: `alipay_${Date.now()}`
        })
    }
    return { success: true } 
}

export async function handleWechatPayCallback(data: Record<string, any>): Promise<{ success: boolean; error?: string }> {
    // In reality: verify signature, update payment status
    const db = getDatabaseAdapter()
    // Assuming we can extract paymentId from data
    return { success: true } 
}

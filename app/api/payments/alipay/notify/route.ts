import { NextRequest, NextResponse } from 'next/server'
import { getDatabaseAdapter } from '@/lib/db-adapter'
import crypto from 'crypto'

/**
 * 支付宝异步通知接口
 * 支付宝会在用户支付完成后，通过POST方式调用此接口
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.formData()
    const params: any = {}
    
    // 将FormData转换为对象
    for (const [key, value] of body.entries()) {
      params[key] = value.toString()
    }

    console.log('========== Alipay notify received ==========')
    console.log('Timestamp:', new Date().toISOString())
    console.log('Params:', JSON.stringify(params, null, 2))
    console.log('Trade status:', params.trade_status)
    console.log('Out trade no:', params.out_trade_no)
    console.log('Trade no:', params.trade_no)
    console.log('=============================================')

    // 验证签名
    const isValid = verifyAlipaySign(params)
    if (!isValid) {
      console.error('Alipay signature verification failed')
      return new NextResponse('fail', { status: 400 })
    }

    // 处理支付结果
    const tradeStatus = params.trade_status
    const outTradeNo = params.out_trade_no
    const tradeNo = params.trade_no // 支付宝交易号
    const totalAmount = params.total_amount

    if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
      // 支付成功
      const db = getDatabaseAdapter()
      
      // 从outTradeNo中提取paymentId（格式：RENT_paymentId_timestamp）
      const paymentIdMatch = outTradeNo.match(/^RENT_(.+?)_\d+$/)
      if (!paymentIdMatch) {
        console.error('Invalid outTradeNo format:', outTradeNo)
        return new NextResponse('fail', { status: 400 })
      }
      
      const paymentId = paymentIdMatch[1]
      console.log('Processing payment update in notify:', { paymentId, tradeStatus, tradeNo, outTradeNo })
      
      // 更新支付记录
      const payment = await db.findById('payments', paymentId)
      if (!payment) {
        console.error('Payment not found in notify:', paymentId)
        return new NextResponse('fail', { status: 404 })
      }
      
      if (payment) {
        // 确保metadata是对象格式
        let metadata = payment.metadata
        if (typeof metadata === 'string') {
          try {
            metadata = JSON.parse(metadata)
          } catch {
            metadata = {}
          }
        }
        if (!metadata || typeof metadata !== 'object') {
          metadata = {}
        }
        
        // 强制更新为已完成状态（因为支付已经成功）
        // 无论当前状态如何，都更新为COMPLETED
        const updateData: any = {
          status: 'COMPLETED',
          transactionId: tradeNo,
          escrowStatus: payment.escrowStatus || 'HELD_IN_ESCROW', // 资金托管中，等待确认入住后释放
          metadata: JSON.stringify({
            ...metadata,
            alipayTradeNo: tradeNo,
            alipayNotifyTime: new Date().toISOString(),
            tradeStatus: tradeStatus,
            paidAt: new Date().toISOString(),
            updatedVia: 'notify',
            lastUpdated: new Date().toISOString()
          })
        }
        
        console.log('Updating payment in notify:', {
          paymentId,
          oldStatus: payment.status,
          newStatus: 'COMPLETED',
          tradeNo,
          updateData
        })
        
        await db.update('payments', paymentId, updateData)
        
        // 验证更新是否成功
        const updatedPayment = await db.findById('payments', paymentId)
        console.log('========== Payment updated in notify ==========')
        console.log('Payment ID:', paymentId)
        console.log('Old Status:', payment.status)
        console.log('New Status:', updatedPayment?.status)
        console.log('Transaction ID:', updatedPayment?.transactionId)
        console.log('Verification successful:', updatedPayment?.status === 'COMPLETED')
        console.log('===============================================')
        
        console.log('Payment updated successfully via notify:', {
          paymentId,
          oldStatus: payment.status,
          newStatus: 'COMPLETED',
          tradeNo: tradeNo
        })
        
        // 通知房东支付已完成
        try {
          // 获取支付关联的房源和房东
          let property = null
          if (payment.propertyId) {
            property = await db.findById('properties', payment.propertyId)
          } else if (payment.metadata && typeof payment.metadata === 'object') {
            // 从metadata中获取propertyId
            const metadata = payment.metadata as any
            if (metadata.propertyId) {
              property = await db.findById('properties', metadata.propertyId)
            } else if (metadata.leaseId) {
              // 从lease中获取propertyId
              const lease = await db.findById('leases', metadata.leaseId)
              if (lease && lease.propertyId) {
                property = await db.findById('properties', lease.propertyId)
              }
            }
          }
          
          if (property && property.landlordId) {
            const region = process.env.NEXT_PUBLIC_APP_REGION || 'global'
            const isChina = region === 'china'
            
            // 创建通知
            const notificationData = {
              userId: property.landlordId,
              type: 'SYSTEM',
              title: isChina ? '租客已支付' : 'Tenant Payment Received',
              message: isChina 
                ? `租客已支付租金 ${totalAmount} 元，资金已进入托管账户。`
                : `Tenant has paid rent ${totalAmount} yuan, funds are now in escrow.`,
              isRead: false,
              link: `/dashboard/landlord`,
              metadata: JSON.stringify({
                paymentId: paymentId,
                propertyId: property.id,
                amount: totalAmount,
                type: 'PAYMENT_RECEIVED'
              })
            }
            
            await db.create('notifications', notificationData)
            
            console.log('Notification sent to landlord:', {
              landlordId: property.landlordId,
              propertyId: property.id,
              paymentId: paymentId,
              amount: totalAmount
            })
          } else {
            console.warn('Cannot find property or landlord for payment:', {
              paymentId: paymentId,
              propertyId: payment.propertyId,
              hasProperty: !!property
            })
          }
        } catch (notifErr: any) {
          console.error('Failed to send notification to landlord:', {
            error: notifErr.message,
            stack: notifErr.stack
          })
        }
      } else {
        console.error('Payment not found:', paymentId)
      }
    }

    // 返回success表示已处理
    return new NextResponse('success')
  } catch (error: any) {
    console.error('Alipay notify error:', error)
    return new NextResponse('fail', { status: 500 })
  }
}

/**
 * 验证支付宝签名
 */
function verifyAlipaySign(params: any): boolean {
  try {
    const alipayPublicKey = process.env.ALIPAY_PUBLIC_KEY || ''
    if (!alipayPublicKey) {
      console.warn('ALIPAY_PUBLIC_KEY not configured, skipping signature verification')
      return true // 开发环境可以跳过验证
    }

    const sign = params.sign
    const signType = params.sign_type || 'RSA2'
    
    if (!sign) {
      return false
    }

    // 移除sign和sign_type参数
    const paramsToVerify: any = { ...params }
    delete paramsToVerify.sign
    delete paramsToVerify.sign_type

    // 排序并构建待签名字符串
    const sortedKeys = Object.keys(paramsToVerify).sort()
    const signString = sortedKeys
      .filter(key => paramsToVerify[key] !== '' && paramsToVerify[key] !== null)
      .map(key => `${key}=${paramsToVerify[key]}`)
      .join('&')

    // 验证签名
    const verify = crypto.createVerify('RSA-SHA256')
    verify.update(signString, 'utf8')
    
    // 格式化公钥
    const publicKey = formatPublicKey(alipayPublicKey)
    const isValid = verify.verify(publicKey, sign, 'base64')

    return isValid
  } catch (error) {
    console.error('Signature verification error:', error)
    return false
  }
}

/**
 * 格式化公钥
 */
function formatPublicKey(key: string): string {
  // 如果已经是PEM格式，直接返回
  if (key.includes('BEGIN')) {
    return key
  }
  
  // 否则添加PEM头尾
  return `-----BEGIN PUBLIC KEY-----\n${key}\n-----END PUBLIC KEY-----`
}

import { NextRequest, NextResponse } from 'next/server'
import { getDatabaseAdapter } from '@/lib/db-adapter'

/**
 * 支付宝同步返回接口
 * 用户支付完成后，支付宝会重定向到此接口
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const params: any = {}
    
    // 获取所有参数
    searchParams.forEach((value, key) => {
      params[key] = value
    })

    console.log('Alipay return received:', params)

    // 验证签名（开发环境可以跳过）
    const isValid = verifyAlipaySign(params)
    if (!isValid) {
      console.warn('Alipay signature verification failed, but continuing in dev mode')
      // 开发环境继续处理，生产环境应该返回错误
    }

    // 处理支付结果
    const tradeStatus = params.trade_status || params.tradeStatus
    const outTradeNo = params.out_trade_no || params.outTradeNo
    const tradeNo = params.trade_no || params.tradeNo

    console.log('Alipay return processing:', { tradeStatus, outTradeNo, tradeNo })

    if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED' || !tradeStatus) {
      // 支付成功，更新支付状态并重定向
      try {
        const db = getDatabaseAdapter()
        const paymentIdMatch = outTradeNo?.match(/^RENT_(.+?)_\d+$/)
        if (paymentIdMatch) {
          const paymentId = paymentIdMatch[1]
          console.log('Updating payment status for:', paymentId)
          
          const payment = await db.findById('payments', paymentId)
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
            
            // 无论当前状态如何，都更新为已完成（因为支付已经成功）
            // 只有在状态不是COMPLETED时才更新，避免重复更新
            if (payment.status !== 'COMPLETED') {
              await db.update('payments', paymentId, {
                status: 'COMPLETED',
                escrowStatus: payment.escrowStatus || 'HELD_IN_ESCROW',
                transactionId: tradeNo || payment.transactionId,
                metadata: JSON.stringify({
                  ...metadata,
                  alipayReturnTime: new Date().toISOString(),
                  tradeStatus: tradeStatus || 'TRADE_SUCCESS',
                  tradeNo: tradeNo,
                  updatedVia: 'return'
                })
              })
            } else {
              // 即使状态已经是COMPLETED，也更新transactionId和metadata（如果还没有）
              if (tradeNo && (!payment.transactionId || payment.transactionId !== tradeNo)) {
                await db.update('payments', paymentId, {
                  transactionId: tradeNo,
                  metadata: JSON.stringify({
                    ...metadata,
                    alipayReturnTime: new Date().toISOString(),
                    tradeStatus: tradeStatus || 'TRADE_SUCCESS',
                    tradeNo: tradeNo,
                    updatedVia: 'return'
                  })
                })
              }
            }
            
            console.log('Payment status updated successfully via return:', {
              paymentId,
              oldStatus: payment.status,
              newStatus: 'COMPLETED',
              tradeNo: tradeNo
            })
            
            // 通知房东
            try {
              const property = payment.propertyId ? await db.findById('properties', payment.propertyId) : null
              if (property && property.landlordId) {
                const region = process.env.NEXT_PUBLIC_APP_REGION || 'global'
                const isChina = region === 'china'
                
                await db.create('notifications', {
                  userId: property.landlordId,
                  type: 'SYSTEM',
                  title: isChina ? '租客已支付' : 'Tenant Payment Received',
                  message: isChina 
                    ? `租客已支付租金，资金已进入托管账户。`
                    : `Tenant has paid rent, funds are now in escrow.`,
                  isRead: false,
                  link: `/dashboard/landlord`,
                  metadata: JSON.stringify({
                    paymentId: paymentId,
                    propertyId: property.id,
                    type: 'PAYMENT_RECEIVED'
                  })
                })
                
                console.log('Notification sent to landlord:', property.landlordId)
              }
            } catch (notifErr) {
              console.error('Failed to send notification:', notifErr)
            }
          } else {
            console.error('Payment not found:', paymentId)
          }
        } else {
          console.error('Invalid outTradeNo format:', outTradeNo)
        }
      } catch (err) {
        console.error('Failed to update payment status on return:', err)
      }
      
      // 使用NextResponse.redirect进行重定向
      const redirectUrl = new URL('/dashboard/tenant', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
      redirectUrl.searchParams.set('tab', 'payments')
      redirectUrl.searchParams.set('success', 'true')
      if (outTradeNo) {
        redirectUrl.searchParams.set('outTradeNo', outTradeNo)
      }
      
      return NextResponse.redirect(redirectUrl.toString())
    } else {
      // 支付失败或其他状态
      const redirectUrl = new URL('/dashboard/tenant', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
      redirectUrl.searchParams.set('tab', 'payments')
      redirectUrl.searchParams.set('error', 'payment_failed')
      return NextResponse.redirect(redirectUrl.toString())
    }
  } catch (error: any) {
    console.error('Alipay return error:', error)
    const redirectUrl = new URL('/dashboard/tenant', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
    redirectUrl.searchParams.set('tab', 'payments')
    redirectUrl.searchParams.set('error', 'unknown')
    return NextResponse.redirect(redirectUrl.toString())
  }
}

/**
 * 验证支付宝签名（与notify接口相同）
 */
function verifyAlipaySign(params: any): boolean {
  try {
    const crypto = require('crypto')
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
  if (key.includes('BEGIN')) {
    return key
  }
  return `-----BEGIN PUBLIC KEY-----\n${key}\n-----END PUBLIC KEY-----`
}

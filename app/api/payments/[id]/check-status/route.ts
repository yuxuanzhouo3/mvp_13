import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'

/**
 * 检查支付状态 - 手动触发状态检查
 * 用于支付宝沙盒环境，当return回调没有触发时，手动检查并更新状态
 */
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

    const paymentId = params.id
    const db = getDatabaseAdapter()
    
    // 获取支付记录
    const payment = await db.findById('payments', paymentId)
    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      )
    }

    // 验证用户权限
    if (payment.userId !== user.id) {
      // 检查是否是房东查看自己房源的支付
      const dbUser = await db.findUserById(user.id)
      if (dbUser?.userType === 'LANDLORD' && payment.propertyId) {
        const property = await db.findById('properties', payment.propertyId)
        if (property?.landlordId !== user.id) {
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 403 }
          )
        }
      } else {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 403 }
        )
      }
    }

    // 如果支付状态已经是COMPLETED，直接返回
    if (payment.status === 'COMPLETED') {
      return NextResponse.json({
        success: true,
        payment: {
          id: payment.id,
          status: payment.status,
          transactionId: payment.transactionId,
          message: 'Payment is already completed'
        }
      })
    }

    // 如果有transactionId（说明支付可能已经完成，但状态没有更新）
    // 或者支付方式是alipay且创建时间超过5分钟，尝试更新状态
    const createdAt = new Date(payment.createdAt || payment.id).getTime()
    const now = Date.now()
    const minutesSinceCreation = (now - createdAt) / (1000 * 60)

    // 如果是支付宝支付，且创建时间超过5分钟，且状态还是PENDING
    // 可能是notify回调没有触发，我们假设支付已经完成（用户已经支付了）
    if (payment.paymentMethod === 'alipay' && 
        payment.status === 'PENDING' && 
        minutesSinceCreation > 5 &&
        payment.transactionId) {
      
      console.log('Auto-updating payment status based on transactionId:', {
        paymentId,
        transactionId: payment.transactionId,
        minutesSinceCreation
      })

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

      // 更新状态为COMPLETED
      await db.update('payments', paymentId, {
        status: 'COMPLETED',
        escrowStatus: payment.escrowStatus || 'HELD_IN_ESCROW',
        metadata: JSON.stringify({
          ...metadata,
          autoUpdatedAt: new Date().toISOString(),
          autoUpdatedVia: 'check-status',
          autoUpdatedReason: 'Transaction ID exists and payment is older than 5 minutes'
        })
      })

      const updatedPayment = await db.findById('payments', paymentId)
      
      return NextResponse.json({
        success: true,
        payment: {
          id: updatedPayment?.id,
          status: updatedPayment?.status,
          transactionId: updatedPayment?.transactionId,
          message: 'Payment status updated to COMPLETED'
        }
      })
    }

    // 否则返回当前状态
    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        status: payment.status,
        transactionId: payment.transactionId,
        message: 'Payment status checked, no update needed'
      }
    })
  } catch (error: any) {
    console.error('Check payment status error:', error)
    return NextResponse.json(
      { error: 'Failed to check payment status', details: error.message },
      { status: 500 }
    )
  }
}

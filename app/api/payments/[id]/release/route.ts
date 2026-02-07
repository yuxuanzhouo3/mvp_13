import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { releaseRentPayment } from '@/lib/payment-service'
import { getDatabaseAdapter } from '@/lib/db-adapter'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const paymentId = params.id
    const db = getDatabaseAdapter()
    const payment = await db.findById('payments', paymentId)

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // Verify ownership: Only the tenant who made the payment can release it
    if (payment.userId !== user.id) {
       return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 确认入住：释放资金给房东/中介
    const result = await releaseRentPayment(paymentId)

    if (result.success) {
      // 创建通知（国际化）
      const region = process.env.NEXT_PUBLIC_APP_REGION || 'global'
      const isChina = region === 'china'
      
      const notificationTitle = isChina 
        ? '资金已释放' 
        : 'Funds Released'
      
      const notificationMessage = isChina
        ? '您已确认入住，资金已释放给房东/中介。押金将继续在平台托管。'
        : 'You have confirmed check-in. Funds have been released to landlord/agent. Deposit remains in escrow.'

      await db.create('notifications', {
        userId: user.id,
        type: 'SYSTEM',
        title: notificationTitle,
        message: notificationMessage,
        isRead: false,
        link: `/dashboard/tenant/payments`,
      })

      return NextResponse.json({ 
        success: true,
        message: isChina ? '资金已释放' : 'Funds released successfully'
      })
    } else {
      return NextResponse.json({ error: result.message }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Release payment error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

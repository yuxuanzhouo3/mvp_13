import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { releaseRentPayment } from '@/lib/payment-service'
import { getDatabaseAdapter } from '@/lib/db-adapter'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = getAuthUser(request)
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
    if (payment.userId !== user.userId) {
       return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const result = await releaseRentPayment(paymentId)

    if (result.success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: result.message }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Release payment error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

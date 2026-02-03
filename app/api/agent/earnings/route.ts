import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * Get earnings for agent
 */
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get payments that might be agent commissions
    const payments = await prisma.payment.findMany({
      where: {
        userId: user.userId,
        type: 'SERVICE_FEE'
      },
      orderBy: { createdAt: 'desc' }
    })

    // Calculate totals
    const totalEarnings = payments
      .filter(p => p.status === 'COMPLETED')
      .reduce((sum, p) => sum + p.amount, 0)

    const thisMonth = payments
      .filter(p => {
        const paymentDate = new Date(p.createdAt)
        const now = new Date()
        return paymentDate.getMonth() === now.getMonth() && 
               paymentDate.getFullYear() === now.getFullYear() &&
               p.status === 'COMPLETED'
      })
      .reduce((sum, p) => sum + p.amount, 0)

    const pendingPayouts = payments
      .filter(p => p.status === 'PENDING')
      .reduce((sum, p) => sum + p.amount, 0)

    // Format earnings
    const earnings = payments.map(payment => ({
      id: payment.id,
      amount: payment.amount,
      description: payment.description,
      status: payment.status === 'COMPLETED' ? 'PAID' : 'PENDING',
      createdAt: payment.createdAt
    }))

    return NextResponse.json({
      earnings,
      totalEarnings,
      thisMonth,
      pendingPayouts
    })
  } catch (error: any) {
    console.error('Get earnings error:', error)
    return NextResponse.json(
      { error: 'Failed to get earnings', details: error.message },
      { status: 500 }
    )
  }
}

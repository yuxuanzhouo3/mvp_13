import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * Get payments for current user
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

    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId }
    })

    const where: any = {}
    
    if (dbUser?.userType === 'TENANT') {
      // Tenants see their own payments
      where.userId = user.userId
    } else if (dbUser?.userType === 'LANDLORD') {
      // Landlords see payments for their properties
      where.property = {
        landlordId: user.userId
      }
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        property: {
          select: {
            id: true,
            title: true,
            address: true
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ payments })
  } catch (error: any) {
    console.error('Get payments error:', error)
    return NextResponse.json(
      { error: 'Failed to get payments', details: error.message },
      { status: 500 }
    )
  }
}

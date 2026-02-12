import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * Get transactions for agent
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get all leases (representing completed transactions)
    const leases = await prisma.lease.findMany({
      include: {
        property: {
          select: {
            id: true,
            title: true,
            address: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Get tenant and landlord info for each lease
    const transactions = await Promise.all(leases.map(async (lease) => {
      const tenant = await prisma.user.findUnique({
        where: { id: lease.tenantId },
        select: { name: true, email: true }
      })
      const landlord = await prisma.user.findUnique({
        where: { id: lease.landlordId },
        select: { name: true, email: true }
      })

      return {
        id: lease.id,
        property: lease.property,
        tenant,
        landlord,
        amount: lease.monthlyRent,
        status: lease.status,
        createdAt: lease.createdAt
      }
    }))

    return NextResponse.json({ transactions })
  } catch (error: any) {
    console.error('Get transactions error:', error)
    return NextResponse.json(
      { error: 'Failed to get transactions', details: error.message },
      { status: 500 }
    )
  }
}

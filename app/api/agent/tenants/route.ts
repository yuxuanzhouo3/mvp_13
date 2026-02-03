import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * Get all tenants (for agents to help find homes)
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

    // Get all tenants with their profiles
    const tenants = await prisma.user.findMany({
      where: {
        userType: 'TENANT'
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        tenantProfile: {
          select: {
            monthlyIncome: true,
            creditScore: true,
            employmentStatus: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ tenants })
  } catch (error: any) {
    console.error('Get tenants error:', error)
    return NextResponse.json(
      { error: 'Failed to get tenants', details: error.message },
      { status: 500 }
    )
  }
}

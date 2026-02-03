import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * Get all properties (for agents to browse and manage)
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

    // Get all available properties (agents can see all properties)
    const properties = await prisma.property.findMany({
      where: {
        status: 'AVAILABLE'
      },
      include: {
        landlord: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ properties })
  } catch (error: any) {
    console.error('Get agent properties error:', error)
    return NextResponse.json(
      { error: 'Failed to get properties', details: error.message },
      { status: 500 }
    )
  }
}

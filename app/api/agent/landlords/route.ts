import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * Get all landlords (for agents to connect with)
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

    // Get all landlords with their property counts
    const landlords = await prisma.user.findMany({
      where: {
        userType: 'LANDLORD'
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        landlordProfile: true,
        _count: {
          select: {
            properties: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Format the response
    const formattedLandlords = landlords.map(landlord => ({
      id: landlord.id,
      name: landlord.name,
      email: landlord.email,
      phone: landlord.phone,
      propertyCount: landlord._count.properties,
      companyName: landlord.landlordProfile?.companyName,
      verified: landlord.landlordProfile?.verified || false,
      createdAt: landlord.createdAt
    }))

    return NextResponse.json({ landlords: formattedLandlords })
  } catch (error: any) {
    console.error('Get landlords error:', error)
    return NextResponse.json(
      { error: 'Failed to get landlords', details: error.message },
      { status: 500 }
    )
  }
}

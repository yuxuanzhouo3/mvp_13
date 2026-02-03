import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * Get saved properties for current user
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

    const savedProperties = await prisma.savedProperty.findMany({
      where: { userId: user.userId },
      include: {
        property: {
          include: {
            landlord: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const properties = savedProperties.map(sp => ({
      id: sp.property.id,
      title: sp.property.title,
      location: `${sp.property.city}, ${sp.property.state}`,
      price: sp.property.price,
      beds: sp.property.bedrooms,
      baths: sp.property.bathrooms,
      sqft: sp.property.sqft || 0,
      image: Array.isArray(sp.property.images) 
        ? (sp.property.images[0] || '/placeholder.svg')
        : (typeof sp.property.images === 'string' 
          ? (JSON.parse(sp.property.images)?.[0] || '/placeholder.svg')
          : '/placeholder.svg'),
      status: sp.property.status?.toLowerCase() || 'available',
    }))

    return NextResponse.json({ properties })
  } catch (error: any) {
    console.error('Get saved properties error:', error)
    return NextResponse.json(
      { error: 'Failed to get saved properties', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Save a property
 */
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { propertyId } = body

    if (!propertyId) {
      return NextResponse.json(
        { error: 'Property ID is required' },
        { status: 400 }
      )
    }

    // Check if already saved
    const existing = await prisma.savedProperty.findUnique({
      where: {
        userId_propertyId: {
          userId: user.userId,
          propertyId
        }
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Property already saved' },
        { status: 400 }
      )
    }

    const savedProperty = await prisma.savedProperty.create({
      data: {
        userId: user.userId,
        propertyId
      },
      include: {
        property: true
      }
    })

    return NextResponse.json({ savedProperty })
  } catch (error: any) {
    console.error('Save property error:', error)
    return NextResponse.json(
      { error: 'Failed to save property', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Remove saved property
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get('propertyId')

    if (!propertyId) {
      return NextResponse.json(
        { error: 'Property ID is required' },
        { status: 400 }
      )
    }

    await prisma.savedProperty.delete({
      where: {
        userId_propertyId: {
          userId: user.userId,
          propertyId
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Remove saved property error:', error)
    return NextResponse.json(
      { error: 'Failed to remove saved property', details: error.message },
      { status: 500 }
    )
  }
}

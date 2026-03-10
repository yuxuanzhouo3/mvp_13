import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'

/**
 * Get saved properties for current user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const db = getDatabaseAdapter()
    let resolvedUserId = user.id
    try {
      const userById = await db.findUserById(user.id)
      const userByEmail = !userById && user.email ? await db.findUserByEmail(user.email) : null
      const resolvedUser = userById || userByEmail
      if (resolvedUser?.id) {
        resolvedUserId = resolvedUser.id
      }
    } catch {}

    const savedProperties = await db.query('savedProperties', { userId: resolvedUserId })

    // 排序
    savedProperties.sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt).getTime()
      const dateB = new Date(b.createdAt).getTime()
      return dateB - dateA
    })

    // 加载房源信息
    const properties = await Promise.all(
      savedProperties.map(async (sp: any) => {
        const property = await db.findById('properties', sp.propertyId)
        if (!property) return null

        const landlord = await db.findUserById(property.landlordId)
        let images: any[] = []
        if (Array.isArray(property.images)) {
          images = property.images
        } else if (typeof property.images === 'string') {
          try {
            images = JSON.parse(property.images)
          } catch {
            images = []
          }
        }

        return {
          id: property.id,
          title: property.title,
          location: `${property.city}, ${property.state}`,
          price: property.price,
          beds: property.bedrooms,
          baths: property.bathrooms,
          sqft: property.sqft || 0,
          image: images[0] || '/placeholder.svg',
          status: property.status?.toLowerCase() || 'available',
        }
      })
    )

    return NextResponse.json({ properties: properties.filter(Boolean) })
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
    const user = await getCurrentUser(request)
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

    const db = getDatabaseAdapter()
    let resolvedUserId = user.id
    try {
      const userById = await db.findUserById(user.id)
      const userByEmail = !userById && user.email ? await db.findUserByEmail(user.email) : null
      const resolvedUser = userById || userByEmail
      if (resolvedUser?.id) {
        resolvedUserId = resolvedUser.id
      }
    } catch {}

    // Check if already saved
    const allSaved = await db.query('savedProperties', { userId: resolvedUserId })
    const existing = allSaved.find((sp: any) => sp.propertyId === propertyId)

    if (existing) {
      return NextResponse.json(
        { error: 'Property already saved' },
        { status: 400 }
      )
    }

    const savedProperty = await db.create('savedProperties', {
      userId: resolvedUserId,
      propertyId,
    })

    const property = await db.findById('properties', propertyId)
    const savedPropertyWithProperty = {
      ...savedProperty,
      property,
    }

    return NextResponse.json({ savedProperty: savedPropertyWithProperty })
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
    const user = await getCurrentUser(request)
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

    const db = getDatabaseAdapter()
    let resolvedUserId = user.id
    try {
      const userById = await db.findUserById(user.id)
      const userByEmail = !userById && user.email ? await db.findUserByEmail(user.email) : null
      const resolvedUser = userById || userByEmail
      if (resolvedUser?.id) {
        resolvedUserId = resolvedUser.id
      }
    } catch {}
    const allSaved = await db.query('savedProperties', { userId: resolvedUserId })
    const savedProperty = allSaved.find((sp: any) => sp.propertyId === propertyId)

    if (savedProperty) {
      await db.delete('savedProperties', savedProperty.id)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Remove saved property error:', error)
    return NextResponse.json(
      { error: 'Failed to remove saved property', details: error.message },
      { status: 500 }
    )
  }
}

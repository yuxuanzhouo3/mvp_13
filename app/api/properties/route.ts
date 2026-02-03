import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * 创建房源
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

    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId }
    })

    if (dbUser?.userType !== 'LANDLORD') {
      return NextResponse.json(
        { error: 'Only landlords can create properties' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      title,
      description,
      address,
      city,
      state,
      zipCode,
      country,
      latitude,
      longitude,
      price,
      deposit,
      bedrooms,
      bathrooms,
      sqft,
      propertyType,
      images,
      amenities,
      petFriendly,
      availableFrom,
      leaseDuration
    } = body

    const property = await prisma.property.create({
      data: {
        landlordId: user.userId,
        title,
        description,
        address,
        city,
        state,
        zipCode: zipCode || '',
        country: country || 'US',
        latitude,
        longitude,
        price: parseFloat(price),
        deposit: parseFloat(deposit),
        bedrooms: parseInt(bedrooms),
        bathrooms: parseFloat(bathrooms),
        sqft: sqft ? parseInt(sqft) : null,
        propertyType,
        images: Array.isArray(images) ? JSON.stringify(images) : (images || '[]'),
        amenities: Array.isArray(amenities) ? JSON.stringify(amenities) : (amenities || '[]'),
        petFriendly: petFriendly || false,
        availableFrom: availableFrom ? new Date(availableFrom) : null,
        leaseDuration: leaseDuration ? parseInt(leaseDuration) : null
      }
    })

    return NextResponse.json({ property })
  } catch (error: any) {
    console.error('Create property error:', error)
    return NextResponse.json(
      { error: 'Failed to create property', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * 获取房源列表
 */
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    const { searchParams } = new URL(request.url)
    const landlordId = searchParams.get('landlordId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: any = {}
    if (landlordId) {
      where.landlordId = landlordId
    } else if (user) {
      // 如果未指定landlordId，只返回当前用户的房源
      const dbUser = await prisma.user.findUnique({
        where: { id: user.userId }
      })
      if (dbUser?.userType === 'LANDLORD') {
        where.landlordId = user.userId
      }
    }

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        include: {
          landlord: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.property.count({ where })
    ])

    return NextResponse.json({
      properties,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error: any) {
    console.error('Get properties error:', error)
    return NextResponse.json(
      { error: 'Failed to get properties', details: error.message },
      { status: 500 }
    )
  }
}

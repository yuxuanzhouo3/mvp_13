import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * 房源搜索接口
 */
export async function GET(request: NextRequest) {
  try {
    // Allow unauthenticated users to search
    const { searchParams } = new URL(request.url)
    const city = searchParams.get('city')
    const state = searchParams.get('state')
    const minPrice = searchParams.get('minPrice')
    const maxPrice = searchParams.get('maxPrice')
    const minBedrooms = searchParams.get('minBedrooms')
    const minBathrooms = searchParams.get('minBathrooms')
    const petFriendly = searchParams.get('petFriendly')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: any = {
      status: 'AVAILABLE'
    }

    if (city) where.city = { contains: city, mode: 'insensitive' }
    if (state) where.state = { contains: state, mode: 'insensitive' }
    
    if (minPrice || maxPrice) {
      where.price = {}
      if (minPrice) where.price.gte = parseFloat(minPrice)
      if (maxPrice) where.price.lte = parseFloat(maxPrice)
    }

    if (minBedrooms) where.bedrooms = { gte: parseInt(minBedrooms) }
    if (minBathrooms) where.bathrooms = { gte: parseFloat(minBathrooms) }
    if (petFriendly === 'true') where.petFriendly = true

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
    console.error('Property search error:', error)
    return NextResponse.json(
      { error: 'Search failed', details: error.message },
      { status: 500 }
    )
  }
}

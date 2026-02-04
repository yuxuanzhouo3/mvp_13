import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'

/**
 * 创建房源
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

    const db = getDatabaseAdapter()
    const dbUser = await db.findUserById(user.id)

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

    // 使用数据库适配器创建房源（统一接口）
    const property = await db.create('properties', {
      landlordId: user.id,
      title,
      description,
      address,
      city,
      state,
      zipCode: zipCode || '',
      country: country || (process.env.NEXT_PUBLIC_APP_REGION === 'china' ? 'CN' : 'US'),
      latitude,
      longitude,
      price: parseFloat(price),
      deposit: parseFloat(deposit),
      bedrooms: parseInt(bedrooms),
      bathrooms: parseFloat(bathrooms),
      sqft: sqft ? parseInt(sqft) : null,
      propertyType,
      images: Array.isArray(images) ? images : (images ? JSON.parse(images) : []),
      amenities: Array.isArray(amenities) ? amenities : (amenities ? JSON.parse(amenities) : []),
      petFriendly: petFriendly || false,
      availableFrom: availableFrom ? new Date(availableFrom) : null,
      leaseDuration: leaseDuration ? parseInt(leaseDuration) : null,
      status: 'AVAILABLE',
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
    const user = await getCurrentUser(request)
    const { searchParams } = new URL(request.url)
    const landlordId = searchParams.get('landlordId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const db = getDatabaseAdapter()
    
    // 构建查询条件
    const filters: any = {}
    if (landlordId) {
      filters.landlordId = landlordId
    } else if (user) {
      // 如果未指定landlordId，只返回当前用户的房源
      try {
        const dbUser = await db.findUserById(user.id)
        if (dbUser?.userType === 'LANDLORD') {
          filters.landlordId = user.id
          console.log('Querying properties for landlord:', user.id)
        } else {
          console.log('User is not a landlord, userType:', dbUser?.userType)
        }
      } catch (error: any) {
        console.error('Error fetching user:', error)
        // 如果查询用户失败，仍然尝试使用 user.id
        filters.landlordId = user.id
      }
    }
    
    console.log('Properties query filters:', filters)

    // 查询房源（使用数据库适配器，自动处理 Prisma 和 CloudBase 的差异）
    // 先获取总数（不分页）
    const allProperties = await db.query('properties', filters, {
      orderBy: { createdAt: 'desc' }
    })
    const total = allProperties.length
    console.log(`Found ${total} properties matching filters`)
    
    // 分页查询
    const properties = await db.query('properties', filters, {
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    })
    console.log(`Returning ${properties.length} properties for page ${page}`)
    
    // 为每个房源添加房东信息（如果需要）
    const propertiesWithLandlord = await Promise.all(
      properties.map(async (property: any) => {
        const landlord = await db.findUserById(property.landlordId)
        return {
          ...property,
          landlord: landlord ? {
            id: landlord.id,
            name: landlord.name,
            email: landlord.email,
          } : null,
        }
      })
    )

    return NextResponse.json({
      properties: propertiesWithLandlord,
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

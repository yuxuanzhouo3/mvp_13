import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getAuthUser } from '@/lib/auth'
import { getDatabaseAdapter } from '@/lib/db-adapter'

/**
 * 创建房源
 */
export async function POST(request: NextRequest) {
  try {
    const db = getDatabaseAdapter()

    let user = await getCurrentUser(request)

    // 如果 getCurrentUser 失败，尝试使用 legacy auth 并从 JWT token 中提取完整信息
    if (!user) {
      const legacyAuth = getAuthUser(request)
      if (legacyAuth) {
        // 尝试从 JWT token 中提取完整用户信息（包括 userType）
        let userType = 'TENANT' // 默认值
        try {
          const jwt = require('jsonwebtoken')
          const authHeader = request.headers.get('authorization')
          if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7)
            try {
              const decoded = jwt.verify(
                token,
                process.env.JWT_SECRET || 'your-secret-key'
              ) as { userId: string; email: string; userType?: string }
              userType = decoded.userType || 'TENANT'
            } catch (verifyError) {
              // JWT 验证失败，使用默认值
              console.warn('Failed to verify JWT token:', verifyError)
            }
          }
        } catch (jwtError) {
          // JWT 解析失败，使用默认值
          console.warn('Failed to extract userType from JWT token:', jwtError)
        }

        // 尝试从数据库获取用户信息
        try {
          const legacyDbUser =
            (await db.findUserById(legacyAuth.userId)) ||
            (legacyAuth.email ? await db.findUserByEmail(legacyAuth.email) : null)
          if (legacyDbUser) {
            user = {
              id: legacyDbUser.id,
              email: legacyDbUser.email,
              name: legacyDbUser.name,
              userType: legacyDbUser.userType,
              isPremium: legacyDbUser.isPremium,
              vipLevel: legacyDbUser.vipLevel || (legacyDbUser.isPremium ? 'PREMIUM' : 'FREE'),
            }
          } else {
            // 数据库中没有找到用户，但 JWT token 有效，使用 token 中的信息
            user = {
              id: legacyAuth.userId,
              email: legacyAuth.email,
              name: legacyAuth.email.split('@')[0],
              userType: userType, // 从 JWT token 中获取
              isPremium: false,
              vipLevel: 'FREE',
            }
          }
        } catch (dbError: any) {
          // 如果数据库查询失败，但 legacy auth 有效，使用 JWT token 中的信息
          console.warn('Database query failed but legacy auth is valid:', dbError.message)
          user = {
            id: legacyAuth.userId,
            email: legacyAuth.email,
            name: legacyAuth.email.split('@')[0],
            userType: userType, // 从 JWT token 中获取
            isPremium: false,
            vipLevel: 'FREE',
          }
        }
      }
    }

    if (
      !user ||
      user.id === undefined ||
      user.id === null ||
      (typeof user.id !== 'string' && typeof user.id !== 'number')
    ) {
      console.error('Unauthorized: No valid user found', { user })
      return NextResponse.json(
        { error: 'Unauthorized - 请先登录' },
        { status: 401 }
      )
    }

    // 验证用户类型，如果数据库不可用，使用 user 对象中的 userType
    let dbUser = null
    let userType = user.userType
    try {
      dbUser = (await db.findUserById(user.id)) ||
        (user.email ? await db.findUserByEmail(user.email) : null)
      if (dbUser) {
        userType = dbUser.userType
      }
    } catch (dbError: any) {
      console.warn('Database query failed, using user object userType:', dbError.message)
      // 如果数据库不可用，使用 user 对象中的 userType（从 JWT token 中获取）
      userType = user.userType || 'TENANT'
    }

    if (userType !== 'LANDLORD') {
      return NextResponse.json(
        { error: 'Only landlords can create properties - 只有房东可以创建房源' },
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
      businessArea,
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

    const parsedPrice = typeof price === 'number' ? price : parseFloat(price)
    const parsedDeposit = typeof deposit === 'number' ? deposit : parseFloat(deposit)
    const parsedBedrooms = typeof bedrooms === 'number' ? bedrooms : parseInt(bedrooms)
    const parsedBathrooms = typeof bathrooms === 'number' ? bathrooms : parseFloat(bathrooms)
    const parsedSqft = sqft === null || sqft === undefined || sqft === ''
      ? null
      : (typeof sqft === 'number' ? sqft : parseInt(sqft))

    if (!Number.isFinite(parsedPrice) || !Number.isFinite(parsedDeposit) || !Number.isFinite(parsedBedrooms) || !Number.isFinite(parsedBathrooms)) {
      return NextResponse.json(
        { error: 'Invalid property data' },
        { status: 400 }
      )
    }

    const propertyData = {
      landlordId: user.id,
      title,
      description,
      address,
      city,
      state,
      businessArea: businessArea || '',
      zipCode: zipCode || '',
      country: country || (process.env.NEXT_PUBLIC_APP_REGION === 'china' ? 'CN' : 'US'),
      latitude,
      longitude,
      price: parsedPrice,
      deposit: parsedDeposit,
      bedrooms: parsedBedrooms,
      bathrooms: parsedBathrooms,
      sqft: parsedSqft,
      propertyType,
      images: Array.isArray(images) ? images : (images ? JSON.parse(images) : []),
      amenities: Array.isArray(amenities) ? amenities : (amenities ? JSON.parse(amenities) : []),
      petFriendly: petFriendly || false,
      availableFrom: availableFrom ? new Date(availableFrom) : null,
      leaseDuration: leaseDuration ? parseInt(leaseDuration) : null,
      status: 'AVAILABLE',
    }

    const sanitizedPropertyData = Object.fromEntries(
      Object.entries(propertyData).filter(([, value]) => value !== undefined)
    )

    // 使用数据库适配器创建房源（统一接口）
    let property
    try {
      property = await db.create('properties', sanitizedPropertyData)
    } catch (dbError: any) {
      const errorMsg = String(dbError?.message || '')
      const lower = errorMsg.toLowerCase()
      // 如果数据库连接失败，返回更友好的错误信息
      if (
        lower.includes("can't reach database server") ||
        lower.includes('can\\u2019t reach database server') ||
        lower.includes('maxclients') ||
        lower.includes('max clients reached') ||
        lower.includes('pool_size')
      ) {
        return NextResponse.json(
          { error: '数据库连接失败，请稍后重试', details: 'Database connection pool exhausted' },
          { status: 503 }
        )
      }
      throw dbError
    }

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

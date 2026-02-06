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

    // 处理图片数据：对于 CloudBase，需要限制图片大小或数量
    let processedImages = Array.isArray(images) ? images : (images ? JSON.parse(images) : [])
    const region = process.env.NEXT_PUBLIC_APP_REGION || 'global'
    
    // 如果是国内版（CloudBase），严格限制图片数据大小
    if (region === 'china') {
      // CloudBase 对单个文档大小有限制，base64 图片必须很小
      // 限制图片数量（最多2张）
      processedImages = processedImages.slice(0, 2)
      
      // 严格限制每张图片的 base64 数据大小（每张最多 50KB base64 数据）
      processedImages = processedImages.map((img: string, index: number) => {
        if (typeof img === 'string' && img.startsWith('data:image')) {
          const maxLength = 50000 // 50KB base64 数据
          if (img.length > maxLength) {
            console.warn(`Image ${index + 1} too large for CloudBase (${img.length} bytes), truncating to ${maxLength} bytes...`)
            // 截断 base64 数据，但保留 data URL 前缀
            const commaIndex = img.indexOf(',')
            if (commaIndex > 0) {
              const prefix = img.substring(0, commaIndex + 1)
              const base64Data = img.substring(commaIndex + 1)
              // 计算可用的 base64 数据长度
              const availableLength = maxLength - prefix.length
              if (availableLength > 0 && base64Data.length > availableLength) {
                const truncatedBase64 = base64Data.substring(0, availableLength)
                return prefix + truncatedBase64
              }
            }
            // 如果找不到逗号，直接截断
            return img.substring(0, maxLength)
          }
        }
        return img
      })
      
      // 检查总大小，确保不超过 CloudBase 限制
      const totalSize = JSON.stringify(processedImages).length
      const maxTotalSize = 100000 // 100KB 总大小限制（2张图片，每张50KB）
      if (totalSize > maxTotalSize) {
        console.warn(`Total images size too large (${totalSize} bytes), keeping only first image`)
        processedImages = processedImages.slice(0, 1)
        // 如果单张图片还是太大，进一步截断
        if (processedImages.length > 0 && typeof processedImages[0] === 'string') {
          const firstImg = processedImages[0]
          if (firstImg.length > 50000) {
            const commaIndex = firstImg.indexOf(',')
            if (commaIndex > 0) {
              const prefix = firstImg.substring(0, commaIndex + 1)
              const base64Data = firstImg.substring(commaIndex + 1)
              const availableLength = 50000 - prefix.length
              if (availableLength > 0) {
                processedImages[0] = prefix + base64Data.substring(0, availableLength)
              }
            } else {
              processedImages[0] = firstImg.substring(0, 50000)
            }
          }
        }
      }
      
      console.log(`Processed images for CloudBase: ${processedImages.length} images, total size: ${totalSize} bytes`)
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
      images: processedImages,
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

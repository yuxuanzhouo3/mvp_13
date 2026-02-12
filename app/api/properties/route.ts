import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getAuthUser } from '@/lib/auth'
import { createDatabaseAdapter, getDatabaseAdapter } from '@/lib/db-adapter'
import { prisma } from '@/lib/db'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * 创建房源
 */
export async function POST(request: NextRequest) {
  try {
    const region = process.env.NEXT_PUBLIC_APP_REGION || 'global'
    const db = getDatabaseAdapter()

    const isConnectionError = (error: any) => {
      const msg = String(error?.message || '').toLowerCase()
      return msg.includes('server has closed the connection') ||
        msg.includes('connection') ||
        msg.includes('timeout') ||
        msg.includes('pool') ||
        msg.includes('maxclients')
    }

    const runWithRetry = async <T,>(fn: () => Promise<T>): Promise<T> => {
      try {
        return await fn()
      } catch (error: any) {
        if (!isConnectionError(error)) {
          throw error
        }
        try {
          await prisma.$disconnect()
        } catch {}
        try {
          await prisma.$connect()
        } catch {}
        return await fn()
      }
    }

    let user = await getCurrentUser(request)

    // 如果 getCurrentUser 失败，尝试使用 legacy auth 并从 JWT token 中提取完整信息
    if (!user) {
      const legacyAuth = await getAuthUser(request)
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

    if (userType !== 'LANDLORD' && userType !== 'AGENT') {
      return NextResponse.json(
        { error: 'Only landlords and agents can create properties - 只有房东和中介可以创建房源' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // 确定房源归属
    let targetLandlordId = user.id
    let agentId = null

    if (userType === 'AGENT') {
      if (!body.landlordId) {
        return NextResponse.json(
          { error: 'Agent must specify a landlord - 中介必须指定房东' },
          { status: 400 }
        )
      }
      
      // 验证代理关系
      const landlord = await db.findUserById(body.landlordId)
      if (!landlord) {
        return NextResponse.json(
          { error: 'Landlord not found - 未找到指定房东' },
          { status: 404 }
        )
      }
      
      // 检查该房东是否由当前中介代理
      // 兼容直接字段和 Profile 字段
      let isRepresented = false
      if (landlord.representedById === user.id) {
        isRepresented = true
      } else {
        // 尝试查询 Profile (针对 Supabase/Global 情况)
        try {
          const profiles = await db.query('landlordProfiles', { userId: landlord.id })
          if (profiles && profiles.length > 0 && profiles[0].representedById === user.id) {
            isRepresented = true
          }
        } catch (err) {
          console.warn('Failed to check landlord profile for representation:', err)
        }
      }
      
      if (!isRepresented) {
        const errorMsg = region === 'china' 
          ? 'You do not represent this landlord - 您没有代理该房东的权限' 
          : 'You do not have permission to represent this landlord.'
        return NextResponse.json(
          { error: errorMsg },
          { status: 403 }
        )
      }
      
      targetLandlordId = landlord.id
      agentId = user.id
    }

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
    let processedImages: any[] = []
    if (Array.isArray(images)) {
      processedImages = images
    } else if (images) {
      try {
        processedImages = JSON.parse(images)
      } catch {
        processedImages = []
      }
    }
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

    const propertyData: any = {
      landlordId: targetLandlordId,
      title,
      description,
      address,
      city,
      state,
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
      amenities: Array.isArray(amenities)
        ? amenities
        : (amenities ? (() => {
            try {
              return JSON.parse(amenities)
            } catch {
              return []
            }
          })() : []),
      petFriendly: petFriendly || false,
      availableFrom: availableFrom ? new Date(availableFrom) : null,
      leaseDuration: leaseDuration ? parseInt(leaseDuration) : null,
      status: 'AVAILABLE',
    }
    if (agentId) {
      propertyData.agentId = agentId
    }

    const sanitizedPropertyData = Object.fromEntries(
      Object.entries(propertyData).filter(([, value]) => value !== undefined)
    )

    // 使用数据库适配器创建房源（统一接口）
    let property
    try {
      if (region === 'global') {
        property = await runWithRetry(() => db.create('properties', sanitizedPropertyData))
      } else {
        property = await db.create('properties', sanitizedPropertyData)
      }
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
      const shouldRetry =
        lower.includes('unknown argument') ||
        (lower.includes('column') && lower.includes('does not exist')) ||
        lower.includes('does not exist')
      if (shouldRetry && region === 'global') {
        const columnsResult: any[] = await prisma.$queryRawUnsafe(
          `SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Property'`
        )
        const fallbackColumns = columnsResult.length
          ? columnsResult
          : (await prisma.$queryRawUnsafe(
              `SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'property'`
            ) as any[])
        const columnsInfo = (fallbackColumns || []) as any[]
        const existingColumns = new Set(
          columnsInfo.map((col: any) => String(col.column_name))
        )
        const entriesMap = new Map(
          Object.entries(sanitizedPropertyData).filter(([key]) => existingColumns.has(key))
        )
        if (existingColumns.has('id') && !entriesMap.has('id')) {
          entriesMap.set('id', randomUUID())
        }
        const now = new Date()
        if (existingColumns.has('createdAt') && !entriesMap.has('createdAt')) {
          entriesMap.set('createdAt', now)
        }
        if (existingColumns.has('updatedAt') && !entriesMap.has('updatedAt')) {
          entriesMap.set('updatedAt', now)
        }
        const entries = Array.from(entriesMap.entries())
        if (entries.length > 0) {
          const columns = entries.map(([key]) => `"${key}"`).join(', ')
          const placeholders = entries.map(([key], index) => {
            const position = index + 1
            if (key === 'images' || key === 'amenities') {
              return `$${position}::jsonb`
            }
            return `$${position}`
          }).join(', ')
          const values = entries.map(([key, value]) => {
            if (key === 'images' || key === 'amenities') {
              return JSON.stringify(value ?? [])
            }
            return value
          })
          const insertSql = `INSERT INTO "Property" (${columns}) VALUES (${placeholders}) RETURNING *`
          const inserted: any = await prisma.$queryRawUnsafe(insertSql, ...values)
          property = Array.isArray(inserted) ? inserted[0] : inserted
          return NextResponse.json({ property })
        }
      }
      if (shouldRetry) {
        const fallbackData: any = {
          landlordId: targetLandlordId,
          title,
          description,
          address,
          city,
          state,
          zipCode: zipCode || '',
          price: parsedPrice,
          deposit: parsedDeposit,
          bedrooms: parsedBedrooms,
          bathrooms: parsedBathrooms,
          propertyType,
          status: 'AVAILABLE',
        }
        if (agentId) {
          fallbackData.agentId = agentId
        }
        property = await db.create('properties', fallbackData)
        return NextResponse.json({ property })
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
    const region = process.env.NEXT_PUBLIC_APP_REGION || 'global'

    const db = getDatabaseAdapter()
    const isConnectionError = (error: any) => {
      const msg = String(error?.message || '').toLowerCase()
      return msg.includes('server has closed the connection') ||
        msg.includes('connection') ||
        msg.includes('timeout') ||
        msg.includes('pool') ||
        msg.includes('maxclients')
    }

    const runWithRetry = async <T,>(fn: () => Promise<T>): Promise<T> => {
      try {
        return await fn()
      } catch (error: any) {
        if (!isConnectionError(error)) {
          throw error
        }
        try {
          await prisma.$disconnect()
        } catch {}
        try {
          await prisma.$connect()
        } catch {}
        return await fn()
      }
    }
    
    const filters: any = {}
    let resolvedUserId: string | null = null
    let tokenUserId: string | null = null
    const authHeader = request.headers.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ') && supabaseAdmin) {
      const token = authHeader.substring(7)
      try {
        const { data } = await supabaseAdmin.auth.getUser(token)
        if (data?.user?.id) {
          tokenUserId = String(data.user.id)
        }
      } catch {}
    }
    
    if (landlordId) {
      filters.landlordId = landlordId
      resolvedUserId = landlordId
    } else if (user) {
      // 如果未指定landlordId，只返回当前用户的房源
      resolvedUserId = user.id
      let landlordIds: string[] = []
      const landlordIdSet = new Set<string>()
      try {
        const dbUser =
          (await db.findUserById(user.id)) ||
          (user.email ? await db.findUserByEmail(user.email) : null)
        if (dbUser) {
          resolvedUserId = dbUser.id
          if (dbUser.userType === 'LANDLORD' || dbUser.userType === 'AGENT') {
            landlordIdSet.add(String(resolvedUserId))
          }
        } else if (user.email && supabaseAdmin) {
          const userTables = ['User', 'user', 'users']
          for (const tableName of userTables) {
            const { data, error } = await supabaseAdmin
              .from(tableName)
              .select('id,userType,email')
              .eq('email', user.email)
              .limit(1)
            if (!error && data && data.length > 0) {
              const row = data[0]
              resolvedUserId = String(row.id)
              const type = String(row.userType || '').toUpperCase()
              if (type === 'LANDLORD' || type === 'AGENT') {
                landlordIdSet.add(String(resolvedUserId))
              }
              break
            }
          }
        } else {
          landlordIdSet.add(String(user.id))
        }
      } catch (error: any) {
        console.error('Error fetching user:', error)
        landlordIdSet.add(String(user.id))
      }
      if (user?.id) landlordIdSet.add(String(user.id))
      if (resolvedUserId) landlordIdSet.add(String(resolvedUserId))
      if (tokenUserId) landlordIdSet.add(String(tokenUserId))
      landlordIds = Array.from(landlordIdSet)
      if (landlordIds.length === 0 && tokenUserId) {
        landlordIds = [tokenUserId]
      }
      if (landlordIds.length > 0) {
        filters.landlordId = landlordIds.length === 1 ? landlordIds[0] : { in: landlordIds }
        console.log('Querying properties for landlord:', landlordIds)
      } else {
        // 如果没有找到有效的 landlordId，返回空结果
        return NextResponse.json({
          properties: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0
          }
        })
      }
    } else {
      // 如果没有用户认证，返回空结果
      return NextResponse.json({
        properties: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0
        }
      })
    }
    
    console.log('Properties query filters:', filters, 'resolvedUserId:', resolvedUserId)

    const propertySelect = {
      id: true,
      landlordId: true,
      title: true,
      description: true,
      address: true,
      city: true,
      state: true,
      zipCode: true,
      country: true,
      latitude: true,
      longitude: true,
      price: true,
      deposit: true,
      bedrooms: true,
      bathrooms: true,
      sqft: true,
      propertyType: true,
      status: true,
      images: true,
      amenities: true,
      petFriendly: true,
      availableFrom: true,
      leaseDuration: true,
      createdAt: true,
      updatedAt: true,
    }

    let total = 0
    let properties: any[] = []
    if (region === 'global') {
      try {
        total = await runWithRetry(() => prisma.property.count({ where: filters }))
        properties = await runWithRetry(() => prisma.property.findMany({
          where: filters,
          select: propertySelect,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }))
      } catch (error: any) {
        if (!isConnectionError(error)) {
          throw error
        }
        const fallbackDb = createDatabaseAdapter('china')
        const safeFilters = typeof filters.landlordId === 'object' ? {} : filters
        let allProperties = await fallbackDb.query('properties', safeFilters, {
          orderBy: { createdAt: 'desc' }
        })
        if (typeof filters.landlordId === 'object' && filters.landlordId?.in) {
          const landlordIdSet = new Set(filters.landlordId.in.map((id: any) => String(id)))
          allProperties = allProperties.filter((p: any) => landlordIdSet.has(String(p.landlordId || p.landlord_id || '')))
        }
        total = allProperties.length
        properties = allProperties.slice((page - 1) * limit, (page - 1) * limit + limit)
      }
    } else {
      const safeFilters = typeof filters.landlordId === 'object' ? {} : filters
      const allProperties = await db.query('properties', safeFilters, {
        orderBy: { createdAt: 'desc' }
      })
      total = allProperties.length
      console.log(`Found ${total} properties matching filters`)
      properties = await db.query('properties', safeFilters, {
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      })
    }
    console.log(`Returning ${properties.length} properties for page ${page}`)
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
    if (!supabaseAdmin) {
      const { searchParams } = new URL(request.url)
      const page = parseInt(searchParams.get('page') || '1')
      const limit = parseInt(searchParams.get('limit') || '20')
      return NextResponse.json({
        properties: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0
        }
      })
    }
    const normalizeProperty = (p: any) => ({
      ...p,
      landlordId: p.landlordId ?? p.landlord_id,
      createdAt: p.createdAt ?? p.created_at,
      updatedAt: p.updatedAt ?? p.updated_at,
    })
    const propertyTables = ['Property', 'property', 'properties']
    const userTables = ['User', 'user', 'users']
    const selectFrom = async (
      tables: string[],
      builder: (tableName: string) => Promise<{ data: any; error: any; count?: number | null }>
    ) => {
      let lastError: any = null
      for (const tableName of tables) {
        const { data, error, count } = await builder(tableName)
        if (!error) {
          return { data, count }
        }
        lastError = error
      }
      return { data: null, count: null, error: lastError }
    }
    const { searchParams } = new URL(request.url)
    const landlordId = searchParams.get('landlordId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const from = (page - 1) * limit
    const to = from + limit - 1
    let landlordIds: string[] = []
    if (landlordId) {
      landlordIds = [landlordId]
    } else {
      const authHeader = request.headers.get('authorization')
      let tokenEmail = ''
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const jwt = require('jsonwebtoken')
          const decoded = jwt.verify(
            authHeader.substring(7),
            process.env.JWT_SECRET || 'your-secret-key'
          ) as { userId: string; email: string; userType?: string }
          tokenEmail = decoded.email || ''
          if (decoded.userId) {
            landlordIds = [String(decoded.userId)]
          }
        } catch {}
      }
      if (landlordIds.length === 0 && tokenEmail) {
        const { data: userRows } = await selectFrom(userTables, (tableName) =>
          supabaseAdmin
            .from(tableName)
            .select('id,userType,email')
            .eq('email', tokenEmail)
            .limit(1)
        )
        const dbUser = userRows?.[0]
        if (dbUser?.id) {
          landlordIds = [String(dbUser.id)]
        }
      }
    }
    const buildQuery = (tableName: string, landlordField?: string, orderField?: string) => {
      let query = supabaseAdmin
        .from(tableName)
        .select('*', { count: 'exact' })
        .range(from, to)
      if (orderField) {
        query = query.order(orderField, { ascending: false })
      }
      if (landlordField) {
        if (landlordIds.length === 1) {
          query = query.eq(landlordField, landlordIds[0])
        } else if (landlordIds.length > 1) {
          query = query.in(landlordField, landlordIds)
        }
      }
      return query
    }
    let properties: any[] = []
    let count: number | null = null
    for (const tableName of propertyTables) {
      const attempts = [
        { landlordField: 'landlordId', orderField: 'createdAt' },
        { landlordField: 'landlord_id', orderField: 'created_at' },
        { landlordField: 'landlordId', orderField: 'created_at' },
        { landlordField: 'landlord_id', orderField: 'createdAt' },
        { landlordField: 'landlordId', orderField: undefined },
        { landlordField: 'landlord_id', orderField: undefined },
        { landlordField: undefined, orderField: 'createdAt' },
        { landlordField: undefined, orderField: 'created_at' },
        { landlordField: undefined, orderField: undefined },
      ]
      let lastError: any = null
      for (const attempt of attempts) {
        const { data, error, count: countValue } = await buildQuery(
          tableName,
          attempt.landlordField,
          attempt.orderField
        )
        if (!error) {
          properties = (data || []).map(normalizeProperty)
          count = typeof countValue === 'number' ? countValue : null
          lastError = null
          break
        }
        lastError = error
      }
      if (!lastError) {
        break
      }
    }
    if (!properties) {
      properties = []
    }
    const landlordIdSet = new Set((properties || []).map((p: any) => p.landlordId).filter(Boolean))
    let landlordMap = new Map<string, any>()
    if (landlordIdSet.size > 0) {
      const { data: landlords } = await selectFrom(userTables, (tableName) =>
        supabaseAdmin
          .from(tableName)
          .select('id,name,email')
          .in('id', Array.from(landlordIdSet))
      )
      if (landlords) {
        landlordMap = new Map(landlords.map((l: any) => [String(l.id), l]))
      }
    }
    const propertiesWithLandlord = (properties || []).map((property: any) => {
      const landlord = landlordMap.get(String(property.landlordId))
      return {
        ...property,
        landlord: landlord ? {
          id: landlord.id,
          name: landlord.name,
          email: landlord.email,
        } : null,
      }
    })
    const total = typeof count === 'number' ? count : propertiesWithLandlord.length
    return NextResponse.json({
      properties: propertiesWithLandlord,
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit)
      }
    })
  }
}

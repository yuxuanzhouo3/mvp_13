import { NextRequest, NextResponse } from 'next/server'
import { getDatabaseAdapter } from '@/lib/db-adapter'
import { prisma } from '@/lib/db'

/**
 * 房源搜索接口 - 使用数据库适配器，自动根据环境变量选择数据源
 */
export async function GET(request: NextRequest) {
  try {
    // Allow unauthenticated users to search
    const { searchParams } = new URL(request.url)
    const city = searchParams.get('city')
    const keyword = searchParams.get('q')
    const state = searchParams.get('state')
    const minPrice = searchParams.get('minPrice')
    const maxPrice = searchParams.get('maxPrice')
    const minBedrooms = searchParams.get('minBedrooms')
    const minBathrooms = searchParams.get('minBathrooms')
    const petFriendly = searchParams.get('petFriendly')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const db = getDatabaseAdapter()
    const region = process.env.NEXT_PUBLIC_APP_REGION || 'global'
    
    const filters: any = {}
    const statusAllowList = ['AVAILABLE', 'ACTIVE', 'PUBLISHED']
    if (region !== 'china') {
      filters.status = { in: statusAllowList }
      if (keyword && keyword.trim()) {
        const q = keyword.trim()
        filters.OR = [
          { city: { contains: q, mode: 'insensitive' } },
          { state: { contains: q, mode: 'insensitive' } },
          { address: { contains: q, mode: 'insensitive' } },
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } }
        ]
      } else {
        if (city) {
          filters.city = { contains: city, mode: 'insensitive' }
        }
        if (state) {
          filters.state = { contains: state, mode: 'insensitive' }
        }
      }
    }
    
    if (minPrice || maxPrice) {
      // CloudBase 和 Prisma 都支持范围查询，但语法不同
      if (region === 'china') {
        // CloudBase: 需要手动过滤
        filters._minPrice = minPrice ? parseFloat(minPrice) : undefined
        filters._maxPrice = maxPrice ? parseFloat(maxPrice) : undefined
      } else {
        filters.price = {}
        if (minPrice) filters.price.gte = parseFloat(minPrice)
        if (maxPrice) filters.price.lte = parseFloat(maxPrice)
      }
    }

    if (minBedrooms) {
      if (region === 'china') {
        filters._minBedrooms = parseInt(minBedrooms)
      } else {
        filters.bedrooms = { gte: parseInt(minBedrooms) }
      }
    }
    
    if (minBathrooms) {
      if (region === 'china') {
        filters._minBathrooms = parseFloat(minBathrooms)
      } else {
        filters.bathrooms = { gte: parseFloat(minBathrooms) }
      }
    }
    
    if (petFriendly === 'true') filters.petFriendly = true

    const applyMemoryFilters = (items: any[]) => {
      let list = items
      const normalizedKeyword = keyword?.trim().toLowerCase()
      const cityLower = city?.toLowerCase()
      const stateLower = state?.toLowerCase()
      list = list.filter((p: any) => {
        if (p.status && String(p.status).toUpperCase() !== 'AVAILABLE') {
          const normalizedStatus = String(p.status).toUpperCase()
          if (!statusAllowList.includes(normalizedStatus)) {
            return false
          }
        }
        if (normalizedKeyword) {
          const haystack = [
            p.city,
            p.state,
            p.address,
            p.title,
            p.description
          ]
            .filter(Boolean)
            .map((v: any) => String(v).toLowerCase())
            .join(' ')
          if (!haystack.includes(normalizedKeyword)) {
            return false
          }
        } else {
          if (cityLower && (!p.city || !String(p.city).toLowerCase().includes(cityLower))) {
            return false
          }
          if (stateLower && (!p.state || !String(p.state).toLowerCase().includes(stateLower))) {
            return false
          }
        }
        if (filters._minPrice !== undefined && (p.price === undefined || p.price < filters._minPrice)) {
          return false
        }
        if (filters._maxPrice !== undefined && (p.price === undefined || p.price > filters._maxPrice)) {
          return false
        }
        if (filters._minBedrooms !== undefined && (p.bedrooms === undefined || p.bedrooms < filters._minBedrooms)) {
          return false
        }
        if (filters._minBathrooms !== undefined && (p.bathrooms === undefined || p.bathrooms < filters._minBathrooms)) {
          return false
        }
        if (petFriendly === 'true' && p.petFriendly !== true) {
          return false
        }
        return true
      })
      return list
    }

    let allProperties: any[] = []
    try {
      console.log('Search executing with filters:', JSON.stringify(filters))
      if (region === 'china') {
        allProperties = await db.query('properties', filters, {
          orderBy: { createdAt: 'desc' }
        })
      } else {
        const prismaWhere: any = {}
        if (filters.status) {
          prismaWhere.status = filters.status
        }
        if (filters.OR) {
          prismaWhere.OR = filters.OR
        } else {
          if (filters.city) prismaWhere.city = filters.city
          if (filters.state) prismaWhere.state = filters.state
        }
        if (filters.price) prismaWhere.price = filters.price
        if (filters.bedrooms) prismaWhere.bedrooms = filters.bedrooms
        if (filters.bathrooms) prismaWhere.bathrooms = filters.bathrooms
        if (filters.petFriendly !== undefined) prismaWhere.petFriendly = filters.petFriendly
        allProperties = await prisma.property.findMany({
          where: prismaWhere,
          orderBy: { createdAt: 'desc' }
        })
      }
    } catch (error) {
      console.warn('Search query failed, falling back to memory filtering:', error)
      try {
        allProperties = await db.query('properties', {}, {
          orderBy: { createdAt: 'desc' }
        })
      } catch (fallbackError) {
        console.warn('Search fallback query failed:', fallbackError)
        allProperties = []
      }
    }
    console.log(`Search query returned ${allProperties.length} properties`)
    
    const shouldFilterInMemory = Boolean(
      keyword ||
      city ||
      state ||
      minPrice ||
      maxPrice ||
      minBedrooms ||
      minBathrooms ||
      petFriendly === 'true'
    )
    if (region === 'china' || shouldFilterInMemory) {
      allProperties = applyMemoryFilters(allProperties)
    }
    console.log(`After memory filtering: ${allProperties.length} properties`)
    
    // 分页处理
    const total = allProperties.length
    const properties = allProperties.slice((page - 1) * limit, page * limit)
    
    // 为每个房源添加房东信息，并确保ID字段统一
    const propertiesWithLandlord = await Promise.all(
      properties.map(async (property: any) => {
        // 统一ID字段，优先使用id，如果没有则使用其他字段
        const normalizedId = String(
          property?.id || 
          property?._id || 
          property?.propertyId || 
          property?.property_id || 
          ''
        ).trim()
        
        if (!normalizedId) {
          console.warn('Property missing ID:', property)
        }
        
        // 确保返回的对象有统一的id字段
        const normalizedProperty = {
          ...property,
          id: normalizedId,
          // 保留原始ID字段以便兼容
          _id: property?._id || normalizedId,
          propertyId: property?.propertyId || normalizedId,
        }
        
        if (!property?.landlordId) {
          return { ...normalizedProperty, landlord: null }
        }
        
        const landlord = await db.findUserById(property.landlordId)
        return {
          ...normalizedProperty,
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
    console.error('Property search error:', error)
    return NextResponse.json(
      { error: 'Search failed', details: error.message },
      { status: 500 }
    )
  }
}

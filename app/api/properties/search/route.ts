import { NextRequest, NextResponse } from 'next/server'
import { getDatabaseAdapter } from '@/lib/db-adapter'

/**
 * 房源搜索接口 - 使用数据库适配器，自动根据环境变量选择数据源
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

    const db = getDatabaseAdapter()
    const region = process.env.NEXT_PUBLIC_APP_REGION || 'global'
    
    // 构建查询条件（适配 CloudBase 和 Prisma）
    const filters: any = {
      status: 'AVAILABLE'
    }
    
    // 对于 CloudBase，需要先查询所有符合条件的，然后在内存中过滤
    // 对于 Prisma，可以使用复杂的查询条件
    if (region === 'china') {
      // CloudBase: 只使用精确匹配的字段
      // 城市和州的模糊匹配需要在查询后处理
    } else {
      // Prisma: 可以使用 contains
      if (city) {
        filters.city = { contains: city, mode: 'insensitive' }
      }
      if (state) {
        filters.state = { contains: state, mode: 'insensitive' }
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

    // 使用数据库适配器查询
    let allProperties = await db.query('properties', filters, {
      orderBy: { createdAt: 'desc' }
    })
    
    // 对于 CloudBase，需要在内存中过滤
    if (region === 'china') {
      // 过滤城市（模糊匹配）
      if (city) {
        const cityLower = city.toLowerCase()
        allProperties = allProperties.filter((p: any) => 
          p.city && p.city.toLowerCase().includes(cityLower)
        )
      }
      
      // 过滤州（模糊匹配）
      if (state) {
        const stateLower = state.toLowerCase()
        allProperties = allProperties.filter((p: any) => 
          p.state && p.state.toLowerCase().includes(stateLower)
        )
      }
      
      // 过滤价格范围
      if (filters._minPrice !== undefined) {
        allProperties = allProperties.filter((p: any) => p.price >= filters._minPrice)
      }
      if (filters._maxPrice !== undefined) {
        allProperties = allProperties.filter((p: any) => p.price <= filters._maxPrice)
      }
      
      // 过滤卧室数
      if (filters._minBedrooms !== undefined) {
        allProperties = allProperties.filter((p: any) => p.bedrooms >= filters._minBedrooms)
      }
      
      // 过滤浴室数
      if (filters._minBathrooms !== undefined) {
        allProperties = allProperties.filter((p: any) => p.bathrooms >= filters._minBathrooms)
      }
    }
    
    // 分页处理
    const total = allProperties.length
    const properties = allProperties.slice((page - 1) * limit, page * limit)
    
    // 为每个房源添加房东信息
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
    console.error('Property search error:', error)
    return NextResponse.json(
      { error: 'Search failed', details: error.message },
      { status: 500 }
    )
  }
}

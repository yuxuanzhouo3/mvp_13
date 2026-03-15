import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { getAppRegion, getDatabaseAdapter } from '@/lib/db-adapter'
import { prisma } from '@/lib/db'
import { supabaseAdmin } from '@/lib/supabase'

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
    const region = getAppRegion()
    const fetchPropertiesFromSupabase = async () => {
      if (!supabaseAdmin) return []
      const tables = ['Property', 'property', 'properties']
      for (const tableName of tables) {
        const { data, error } = await supabaseAdmin.from(tableName).select('*')
        if (!error && data) return data
      }
      return []
    }
    const fetchUserFromSupabase = async (userId: string) => {
      if (!supabaseAdmin || !userId) return null
      const tables = ['User', 'user', 'users']
      for (const tableName of tables) {
        const { data, error } = await supabaseAdmin
          .from(tableName)
          .select('id,name,email')
          .eq('id', userId)
          .limit(1)
        if (!error && data && data.length > 0) return data[0]
      }
      return null
    }
    
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

    const extractTextFromObject = (value: any) => {
      if (!value || typeof value !== 'object') return ''
      const keys = [
        'city',
        'cityName',
        'city_name',
        'city_cn',
        'district',
        'region',
        'state',
        'stateName',
        'state_name',
        'province',
        'provinceName',
        'province_name',
        'address',
        'addressLine',
        'address_line',
        'location',
        'street',
        'streetAddress',
        'street_address',
        'title',
        'name',
        'propertyName',
        'property_name',
        'description'
      ]
      const parts: any[] = []
      keys.forEach((key) => {
        const v = (value as any)[key]
        if (v !== undefined && v !== null && v !== '') {
          parts.push(v)
        }
      })
      const primitiveValues = Object.values(value).filter((v) => ['string', 'number'].includes(typeof v))
      const merged = [...parts, ...primitiveValues]
      return merged.join(' ')
    }
    const collectPrimitiveValues = (value: any, maxDepth = 4) => {
      const result: any[] = []
      const seen = new Set<any>()
      const stack: Array<{ v: any; depth: number }> = [{ v: value, depth: 0 }]
      while (stack.length > 0) {
        const { v, depth } = stack.pop() as { v: any; depth: number }
        if (v === null || v === undefined) continue
        const t = typeof v
        if (t === 'string' || t === 'number' || t === 'boolean') {
          result.push(v)
          continue
        }
        if (depth >= maxDepth) continue
        if (t === 'object') {
          if (seen.has(v)) continue
          seen.add(v)
          if (Array.isArray(v)) {
            v.forEach((item) => stack.push({ v: item, depth: depth + 1 }))
          } else {
            Object.values(v).forEach((item) => stack.push({ v: item, depth: depth + 1 }))
          }
        }
      }
      return result
    }
    const normalizeText = (value: any) => {
      let text = ''
      if (Array.isArray(value)) {
        text = value.map((v) => normalizeText(v)).join(' ')
      } else if (value && typeof value === 'object') {
        const direct = extractTextFromObject(value)
        const deep = collectPrimitiveValues(value).join(' ')
        text = `${direct} ${deep}`.trim()
      } else {
        text = String(value ?? '')
      }
      return text.replace(/\s+/g, ' ').trim().toLowerCase()
    }
    const matchText = (field: any, query: string) => {
      const left = normalizeText(field)
      const right = normalizeText(query)
      if (!right) return true
      if (!left) return false
      return left.includes(right) || right.includes(left)
    }
    const matchAnyField = (fields: any[], query: string) =>
      fields.some((field) => matchText(field, query))

    const applyMemoryFilters = (items: any[]) => {
      let list = items
      const normalizedKeyword = normalizeText(keyword)
      const keywordTokens = normalizedKeyword
        ? normalizedKeyword.split(/[\s,]+/).filter(Boolean)
        : []
      const cityQuery = normalizeText(city)
      const stateQuery = normalizeText(state)
      list = list.filter((p: any) => {
        const locationValue = p.location ?? p.addressLocation ?? p.geo ?? p.mapLocation
        const addressObject = p.addressInfo ?? p.addressDetail ?? p.address_details ?? p.addressDetails
        const cityValue =
          p.city ??
          p.cityName ??
          p.city_name ??
          p.city_cn ??
          p.district ??
          p.region ??
          locationValue?.city ??
          addressObject?.city ??
          p.address?.city
        const stateValue =
          p.state ??
          p.stateName ??
          p.state_name ??
          p.province ??
          p.provinceName ??
          p.province_name ??
          locationValue?.state ??
          addressObject?.state ??
          p.address?.state
        const addressValue =
          p.address ??
          p.addressLine ??
          p.address_line ??
          p.location ??
          p.street ??
          p.streetAddress ??
          p.street_address ??
          addressObject?.address ??
          addressObject?.detail ??
          addressObject?.detailAddress ??
          addressObject?.fullAddress ??
          addressObject?.full_address
        const titleValue =
          p.title ??
          p.name ??
          p.propertyName ??
          p.property_name ??
          p.buildingName ??
          p.communityName
        if (region !== 'china' && p.status && String(p.status).toUpperCase() !== 'AVAILABLE') {
          const normalizedStatus = String(p.status).toUpperCase()
          if (!statusAllowList.includes(normalizedStatus)) {
            return false
          }
        }
        const textFields = [cityValue, stateValue, addressValue, titleValue, p.description]
        const fullText = normalizeText(p)
        if (keywordTokens.length > 0) {
          const matchToken = keywordTokens.some((token) => matchAnyField(textFields, token))
          if (!matchToken) {
            const matchFallback = keywordTokens.some((token) => fullText.includes(token))
            if (!matchFallback) return false
          }
        } else {
          if (cityQuery && !matchAnyField([cityValue, stateValue, addressValue, titleValue], cityQuery)) {
            if (!fullText.includes(cityQuery)) {
              return false
            }
          }
          if (stateQuery && !matchAnyField([stateValue, cityValue, addressValue, titleValue], stateQuery)) {
            if (!fullText.includes(stateQuery)) {
              return false
            }
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
    let usedSupabaseFallback = false
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
    if (region !== 'china' && supabaseAdmin && allProperties.length === 0) {
      allProperties = await fetchPropertiesFromSupabase()
      usedSupabaseFallback = allProperties.length > 0
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
      const filtered = applyMemoryFilters(allProperties)
      allProperties =
        filtered.length === 0 && (keyword || city || state) && allProperties.length > 0
          ? allProperties
          : filtered
    }
    if (usedSupabaseFallback) {
      allProperties.sort((a: any, b: any) => {
        const dateA = new Date(a.createdAt || a.created_at || 0).getTime()
        const dateB = new Date(b.createdAt || b.created_at || 0).getTime()
        return dateB - dateA
      })
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

        let landlord = null
        try {
          landlord = await db.findUserById(property.landlordId)
        } catch {}
        if (!landlord && region !== 'china') {
          landlord = await fetchUserFromSupabase(String(property.landlordId))
        }
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

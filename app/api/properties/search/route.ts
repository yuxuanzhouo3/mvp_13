import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { getAppRegion, getDatabaseAdapter } from '@/lib/db-adapter'
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase'

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
    const authHeader = request.headers.get('authorization')
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined
    const supabaseClient = createSupabaseServerClient(accessToken)
    const supabaseReaders = [supabaseAdmin, supabaseClient].filter(Boolean) as any[]
    const fetchPropertiesFromSupabase = async () => {
      if (supabaseReaders.length === 0) return []
      const tables = ['Property', 'property', 'properties', 'Listing', 'listing', 'listings']
      for (const client of supabaseReaders) {
        for (const tableName of tables) {
          const { data, error } = await client.from(tableName).select('*')
          if (!error && data) return data
        }
      }
      return []
    }
    const fetchPropertiesFromPropertiesApi = async () => {
      try {
        const url = new URL('/api/properties', request.url)
        url.searchParams.set('page', '1')
        url.searchParams.set('limit', '200')
        const response = await fetch(url.toString(), {
          cache: 'no-store',
          headers: {
            authorization: request.headers.get('authorization') || '',
          },
        })
        if (!response.ok) return []
        const payload = await response.json()
        const rows = Array.isArray(payload?.properties) ? payload.properties : []
        return rows
      } catch {
        return []
      }
    }
    const fetchUserFromSupabase = async (userId: string) => {
      if (supabaseReaders.length === 0 || !userId) return null
      const tables = ['User', 'user', 'users']
      for (const client of supabaseReaders) {
        for (const tableName of tables) {
          const { data, error } = await client
            .from(tableName)
            .select('id,name,email')
            .eq('id', userId)
            .limit(1)
          if (!error && data && data.length > 0) return data[0]
        }
      }
      return null
    }
    
    const getField = (obj: any, keys: string[]) => {
      for (const key of keys) {
        const value = obj?.[key]
        if (value !== undefined && value !== null && value !== '') return value
      }
      return undefined
    }
    const normalizeProperty = (p: any) => {
      const addressObject =
        p?.addressInfo ?? p?.addressDetail ?? p?.addressDetails ?? p?.address_details
      const locationObject = p?.location ?? p?.geo ?? p?.mapLocation
      const addressValue =
        getField(p, ['address', 'addressLine', 'address_line', 'street', 'streetAddress', 'street_address']) ??
        getField(addressObject, ['address', 'detail', 'detailAddress', 'fullAddress', 'full_address']) ??
        (typeof p?.location === 'string' ? p.location : undefined)
      const cityValue =
        getField(p, ['city', 'cityName', 'city_name', 'city_cn', 'district', 'region']) ??
        getField(locationObject, ['city']) ??
        getField(addressObject, ['city']) ??
        getField(p?.address, ['city'])
      const stateValue =
        getField(p, ['state', 'stateName', 'state_name', 'province', 'provinceName', 'province_name']) ??
        getField(locationObject, ['state']) ??
        getField(addressObject, ['state']) ??
        getField(p?.address, ['state'])
      return {
        ...p,
        id: getField(p, ['id', '_id', 'propertyId', 'property_id']),
        landlordId: getField(p, ['landlordId', 'landlord_id', 'ownerId', 'owner_id', 'userId', 'user_id', 'createdBy', 'created_by']),
        title: getField(p, ['title', 'name', 'propertyName', 'property_name', 'buildingName', 'communityName']),
        description: getField(p, ['description', 'desc', 'details']),
        address: addressValue,
        city: cityValue,
        state: stateValue,
        zipCode: getField(p, ['zipCode', 'zip_code', 'postalCode', 'postal_code']),
        country: getField(p, ['country', 'countryName', 'country_name']),
        price: getField(p, ['price', 'rent', 'monthlyRent', 'monthly_rent', 'amount']),
        deposit: getField(p, ['deposit', 'securityDeposit', 'security_deposit']),
        bedrooms: getField(p, ['bedrooms', 'beds', 'bedrooms_count', 'bedroom_count']),
        bathrooms: getField(p, ['bathrooms', 'baths', 'bathrooms_count', 'bathroom_count']),
        sqft: getField(p, ['sqft', 'squareFeet', 'square_feet', 'area']),
        propertyType: getField(p, ['propertyType', 'property_type', 'type', 'category']),
        status: getField(p, ['status', 'listingStatus', 'listing_status']),
        images: getField(p, ['images', 'image', 'image_urls', 'photos', 'photoUrls', 'photo_urls']),
        amenities: getField(p, ['amenities', 'features', 'facilities']),
        petFriendly: getField(p, ['petFriendly', 'pet_friendly', 'isPetFriendly', 'is_pet_friendly']),
        availableFrom: getField(p, ['availableFrom', 'available_from', 'availableDate', 'available_date']),
        leaseDuration: getField(p, ['leaseDuration', 'lease_duration', 'leaseTerm', 'lease_term']),
        createdAt: getField(p, ['createdAt', 'created_at', 'createTime', 'create_time']),
        updatedAt: getField(p, ['updatedAt', 'updated_at', 'updateTime', 'update_time']),
      }
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
        allProperties = await db.query('properties', {}, {
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
    if (region !== 'china' && supabaseReaders.length > 0 && allProperties.length === 0) {
      allProperties = await fetchPropertiesFromSupabase()
      usedSupabaseFallback = allProperties.length > 0
    }
    if (region !== 'china' && allProperties.length === 0) {
      allProperties = await fetchPropertiesFromPropertiesApi()
    }
    console.log(`Search query returned ${allProperties.length} properties`)
    allProperties = allProperties.map(normalizeProperty)
    
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
        
        if (!normalizedProperty?.landlordId) {
          return { ...normalizedProperty, landlord: null }
        }

        let landlord = null
        try {
          landlord = await db.findUserById(normalizedProperty.landlordId)
        } catch {}
        if (!landlord && region !== 'china') {
          landlord = await fetchUserFromSupabase(String(normalizedProperty.landlordId))
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

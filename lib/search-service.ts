/**
 * 第三方搜索服务 - 模拟搜索主流租房/求租平台
 */

import { prisma } from './db'
import { getDatabaseAdapter, getAppRegion } from './db-adapter'
import type { ParsedTenantSearchCriteria, ParsedLandlordSearchCriteria } from './ai-service'

// 模拟的第三方平台数据
const MOCK_RENTAL_PLATFORMS = [
  { name: 'Zillow', url: 'https://zillow.com' },
  { name: 'Apartments.com', url: 'https://apartments.com' },
  { name: 'Rent.com', url: 'https://rent.com' },
  { name: 'Trulia', url: 'https://trulia.com' },
  { name: 'Realtor.com', url: 'https://realtor.com' },
]

const MOCK_TENANT_PLATFORMS = [
  { name: 'North America Housing', url: 'https://xiaowu.com' },
  { name: '1Point3Acres', url: 'https://1point3acres.com' },
  { name: 'CSSA Forum', url: 'https://cssa-forum.com' },
]

export interface SearchResult {
  platform: string
  platformUrl: string
  properties: PropertyResult[]
  totalCount: number
}

export interface PropertyResult {
  id: string
  title: string
  address: string
  city: string
  state: string
  price: number
  bedrooms: number
  bathrooms: number
  sqft?: number
  image?: string
  url: string
  distance?: number // 距离（公里）
  availableFrom?: string
  leaseDuration?: number
}

/**
 * 搜索房源（租客端）
 */
export async function searchRentalProperties(
  criteria: ParsedTenantSearchCriteria,
  userId: string
): Promise<SearchResult[]> {
  try {
    // 只搜索自己的数据库，不搜索第三方平台
    let dbResults: SearchResult | null = null
    try {
      dbResults = await searchOwnDatabase(criteria)
    } catch (error) {
      console.error('Database search error:', error)
      // 如果数据库搜索失败，创建一个空结果
      dbResults = {
        platform: 'RentGuard',
        platformUrl: '/',
        properties: [],
        totalCount: 0
      }
    }
    
    // 保存搜索需求到数据库（不阻塞主流程）
    try {
      await saveTenantRequest(userId, criteria, dbResults ? [dbResults] : [])
    } catch (error) {
      console.error('Failed to save tenant request:', error)
      // 不抛出错误，允许搜索继续进行
    }
    
    return dbResults ? [dbResults] : []
  } catch (error) {
    console.error('Search error:', error)
    // 返回空结果而不是抛出错误
    return []
  }
}

/**
 * 搜索租客（房东端）
 */
export async function searchTenants(
  criteria: ParsedLandlordSearchCriteria,
  userId: string
): Promise<any[]> {
  try {
    // 1. 先搜索自己的数据库
    let dbResults: any[] = []
    try {
      dbResults = await searchOwnTenantDatabase(criteria)
    } catch (error) {
      console.error('Database search error:', error)
    }
    
    // 2. 模拟搜索第三方求租平台 (仅在非国内版且用户需要时启用)
    // 根据用户要求，国内版不搜索第三方平台，只搜索数据库
    let thirdPartyResults: any[] = []
    const isChina = getAppRegion() === 'china'
    
    if (!isChina) {
      try {
        thirdPartyResults = await searchThirdPartyTenantPlatforms(criteria)
      } catch (error) {
        console.error('Third party search error:', error)
      }
    }
    
    // 3. 合并结果
    const allResults = [...dbResults, ...thirdPartyResults]
    
    // 4. 保存搜索需求到数据库（不阻塞主流程）
    try {
      await saveLandlordRequest(userId, { ...criteria, query: (criteria as any).query || '' }, allResults)
    } catch (error) {
      console.error('Failed to save landlord request:', error)
      // 不抛出错误，允许搜索继续进行
    }
    
    return allResults
  } catch (error) {
    console.error('Search error:', error)
    // 返回空结果而不是抛出错误
    return []
  }
}

/**
 * 搜索自己的房源数据库
 */
async function searchOwnDatabase(criteria: ParsedTenantSearchCriteria): Promise<SearchResult> {
  const isChina = getAppRegion() === 'china'

  if (isChina) {
    try {
      const db = getDatabaseAdapter()
      // CloudBase: 获取所有可用房源并在内存中过滤
      // 注意：CloudBaseAdapter.query 目前只支持简单相等查询，复杂查询(gte/lte)被忽略，需在此处处理
      const rawProperties = await db.query('properties', { status: 'AVAILABLE' })
      
      // 内存过滤
      const filteredProperties = rawProperties.filter((p: any) => {
        let match = true
        
        if (criteria.minPrice && (p.price === undefined || p.price < criteria.minPrice)) match = false
        if (criteria.maxPrice && (p.price === undefined || p.price > criteria.maxPrice)) match = false
        if (criteria.minBedrooms && (p.bedrooms === undefined || p.bedrooms < criteria.minBedrooms)) match = false
        if (criteria.minBathrooms && (p.bathrooms === undefined || p.bathrooms < criteria.minBathrooms)) match = false
        
        if (criteria.city && p.city) {
           if (!p.city.toLowerCase().includes(criteria.city.toLowerCase())) match = false
        }
        
        if (criteria.petFriendly !== undefined && p.petFriendly !== criteria.petFriendly) match = false
        
        return match
      }).slice(0, 50)
      
      return {
        platform: 'RentGuard',
        platformUrl: '/',
        properties: filteredProperties.map((p: any) => ({
          id: p.id || p._id,
          title: p.title,
          address: p.address,
          city: p.city,
          state: p.state,
          price: p.price,
          bedrooms: p.bedrooms,
          bathrooms: p.bathrooms,
          sqft: p.sqft || undefined,
          image: (Array.isArray(p.images) ? p.images : [])?.[0] || undefined,
          url: `/properties/${p.id || p._id}`,
          availableFrom: p.availableFrom ? new Date(p.availableFrom).toISOString() : undefined,
          leaseDuration: p.leaseDuration || undefined
        })),
        totalCount: filteredProperties.length
      }
    } catch (error) {
      console.error('CloudBase search error:', error)
      return {
        platform: 'RentGuard',
        platformUrl: '/',
        properties: [],
        totalCount: 0
      }
    }
  }

  try {
    const where: any = {
      status: 'AVAILABLE' as any
    }

    if (criteria.minPrice || criteria.maxPrice) {
      where.price = {}
      if (criteria.minPrice) where.price.gte = criteria.minPrice
      if (criteria.maxPrice) where.price.lte = criteria.maxPrice
    }

    if (criteria.minBedrooms) {
      where.bedrooms = { gte: criteria.minBedrooms }
    }

    if (criteria.minBathrooms) {
      where.bathrooms = { gte: criteria.minBathrooms }
    }

    if (criteria.city) {
      where.city = { contains: criteria.city, mode: 'insensitive' }
    }

    if (criteria.petFriendly !== undefined) {
      where.petFriendly = criteria.petFriendly
    }

    const properties = await prisma.property.findMany({
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
      take: 50
    })

    return {
      platform: 'RentGuard',
      platformUrl: '/',
      properties: properties.map(p => ({
        id: p.id,
        title: p.title,
        address: p.address,
        city: p.city,
        state: p.state,
        price: p.price,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        sqft: p.sqft || undefined,
        image: (Array.isArray(p.images) ? p.images : [])?.[0] || undefined,
        url: `/properties/${p.id}`,
        availableFrom: p.availableFrom?.toISOString(),
        leaseDuration: p.leaseDuration || undefined
      })),
      totalCount: properties.length
    }
  } catch (error) {
    console.error('Database search error:', error)
    // 返回空结果
    return {
      platform: 'RentGuard',
      platformUrl: '/',
      properties: [],
      totalCount: 0
    }
  }
}

/**
 * 搜索自己的租客数据库
 */
async function searchOwnTenantDatabase(criteria: ParsedLandlordSearchCriteria): Promise<any[]> {
  const isChina = getAppRegion() === 'china'

  if (isChina) {
    try {
      const db = getDatabaseAdapter()
      // CloudBase: 分别获取 PENDING 和 UNDER_REVIEW 的申请，然后合并
      // CloudBaseAdapter 目前支持简单的 where 查询，但不支持数组 in 查询
      const pendingApps = await db.query('applications', { status: 'PENDING' })
      const reviewApps = await db.query('applications', { status: 'UNDER_REVIEW' })
      
      // 合并并去重 (以防万一)
      const rawApplications = [...pendingApps, ...reviewApps]
      
      // 内存过滤
      const filteredApplications = []
      
      for (const app of rawApplications) {
        // 状态过滤 (如果 DB 层未过滤)
        if (!['PENDING', 'UNDER_REVIEW'].includes(app.status)) continue
        
        let match = true
        
        // 租金过滤 (关联 property)
        // 假设 app 中有 propertyId，我们需要获取 property 信息来检查价格
        // 或者 app 中已经冗余存储了 propertyPrice
        
        // 简化处理：如果 app 中没有 property 信息，尝试获取
        let property = app.property
        if (!property && app.propertyId) {
             try {
                 const prop = await db.findById('properties', app.propertyId)
                 if (prop) property = prop
             } catch (e) { console.error('Error fetching property', e) }
        }

        if (criteria.minRent || criteria.maxRent) {
           const price = property?.price
           if (price === undefined) {
               match = false // 无法判断价格，保守起见排除，或者根据业务逻辑处理
           } else {
               if (criteria.minRent && price < criteria.minRent) match = false
               if (criteria.maxRent && price > criteria.maxRent) match = false
           }
        }
        
        // 获取租客信息
        let tenant = app.tenant
        if (!tenant && app.tenantId) {
            try {
                const tenantUser = await db.findById('users', app.tenantId)
                if (tenantUser) tenant = tenantUser
            } catch (e) { console.error('Error fetching tenant', e) }
        }

        // 获取租客档案 (如果需要收入、信用分)
        let tenantProfile = tenant?.tenantProfile
        // 如果 tenant 对象中没有 profile，可能需要单独查询
        // 假设简化模型，暂不处理深层关联查询的复杂性，除非必要
        
        // 如果我们无法获取到完整的关联数据，过滤可能不准确。
        // 但根据 MVP 要求，我们尽力匹配
        
        const monthlyIncome = app.monthlyIncome || tenantProfile?.monthlyIncome
        const creditScore = app.creditScore || tenantProfile?.creditScore
        
        if (criteria.requiredIncome && (monthlyIncome === undefined || monthlyIncome < criteria.requiredIncome)) match = false
        if (criteria.minCreditScore && (creditScore === undefined || creditScore < criteria.minCreditScore)) match = false

        if (match && tenant) {
            filteredApplications.push({
                id: tenant.id || tenant._id,
                name: tenant.name,
                email: tenant.email,
                phone: tenant.phone,
                monthlyIncome,
                creditScore,
                applicationId: app.id || app._id,
                property: property ? {
                    id: property.id || property._id,
                    title: property.title,
                    address: property.address
                } : undefined
            })
        }
      }
      
      return filteredApplications.slice(0, 50)
      
    } catch (error) {
      console.error('CloudBase tenant search error:', error)
      return []
    }
  }

  // 根据房东的需求搜索匹配的租客申请和租客资料
  const where: any = {}

  if (criteria.minRent || criteria.maxRent) {
    // 搜索申请记录中的租金要求
    where.property = {
      price: {}
    }
    if (criteria.minRent) where.property.price.gte = criteria.minRent
    if (criteria.maxRent) where.property.price.lte = criteria.maxRent
  }

  const applications = await prisma.application.findMany({
    where: {
      status: { in: ['PENDING', 'UNDER_REVIEW'] as any[] },
      ...where
    },
    include: {
      tenant: {
        include: {
          tenantProfile: true
        }
      },
      property: true
    },
    take: 50
  })

  return applications.map(app => ({
    id: app.tenant.id,
    name: app.tenant.name,
    email: app.tenant.email,
    phone: app.tenant.phone,
    monthlyIncome: app.monthlyIncome || app.tenant.tenantProfile?.monthlyIncome,
    creditScore: app.creditScore || app.tenant.tenantProfile?.creditScore,
    applicationId: app.id,
    property: {
      id: app.property.id,
      title: app.property.title,
      address: app.property.address
    }
  }))
}

/**
 * 模拟搜索第三方租房平台
 */
async function searchThirdPartyRentalPlatforms(
  criteria: ParsedTenantSearchCriteria
): Promise<SearchResult[]> {
  // 这里应该调用真实的第三方API
  // 为了演示，我们返回模拟数据
  
  const results: SearchResult[] = []

  for (const platform of MOCK_RENTAL_PLATFORMS) {
    // 模拟API调用延迟
    await new Promise(resolve => setTimeout(resolve, 100))

    // 生成模拟房源数据
    const mockProperties: PropertyResult[] = []
    const count = Math.floor(Math.random() * 10) + 5

    for (let i = 0; i < count; i++) {
      const basePrice = criteria.maxPrice || 2500
      const price = basePrice + (Math.random() * 1000 - 500)
      
      mockProperties.push({
        id: `external-${platform.name}-${i}`,
        title: `${platform.name} Property ${i + 1}`,
        address: `${Math.floor(Math.random() * 9999)} Main St`,
        city: criteria.city || 'Seattle',
        state: criteria.state || 'WA',
        price: Math.round(price),
        bedrooms: criteria.minBedrooms || Math.floor(Math.random() * 3) + 1,
        bathrooms: criteria.minBathrooms || Math.floor(Math.random() * 2) + 1,
        sqft: Math.floor(Math.random() * 1000) + 500,
        url: `${platform.url}/property/${i}`,
        distance: criteria.maxDistance ? Math.random() * criteria.maxDistance : undefined
      })
    }

    results.push({
      platform: platform.name,
      platformUrl: platform.url,
      properties: mockProperties,
      totalCount: mockProperties.length
    })
  }

  return results
}

/**
 * 模拟搜索第三方求租平台
 */
async function searchThirdPartyTenantPlatforms(
  criteria: ParsedLandlordSearchCriteria
): Promise<any[]> {
  // 模拟搜索北美小屋、一亩三分地等求租平台
  const results: any[] = []

  for (const platform of MOCK_TENANT_PLATFORMS) {
    await new Promise(resolve => setTimeout(resolve, 100))

    const count = Math.floor(Math.random() * 5) + 2
    for (let i = 0; i < count; i++) {
      results.push({
        id: `external-tenant-${platform.name}-${i}`,
        platform: platform.name,
        platformUrl: platform.url,
        name: `Tenant ${i + 1}`,
        email: `tenant${i}@example.com`,
        phone: `+1-555-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
        monthlyIncome: criteria.requiredIncome || Math.floor(Math.random() * 5000) + 3000,
        creditScore: criteria.minCreditScore || Math.floor(Math.random() * 200) + 600,
        minLeaseDuration: criteria.minLeaseDuration || 6,
        url: `${platform.url}/tenant/${i}`
      })
    }
  }

  return results
}

/**
 * 保存租客搜索需求
 */
async function saveTenantRequest(
  userId: string,
  criteria: ParsedTenantSearchCriteria,
  results: SearchResult[]
) {
  await prisma.tenantRequest.create({
    data: {
      tenantId: userId,
      query: criteria.query || '', // 实际应该保存原始查询
      parsedCriteria: criteria as any,
      maxPrice: criteria.maxPrice,
      minPrice: criteria.minPrice,
      maxDistance: criteria.maxDistance,
      minBedrooms: criteria.minBedrooms,
      minBathrooms: criteria.minBathrooms,
      city: criteria.city,
      state: criteria.state,
      minLeaseDuration: criteria.minLeaseDuration,
      petFriendly: criteria.petFriendly,
      amenities: Array.isArray(criteria.amenities) ? criteria.amenities : [],
      searchResults: results as any
    }
  })
}

/**
 * 保存房东搜索需求
 */
async function saveLandlordRequest(
  userId: string,
  criteria: ParsedLandlordSearchCriteria & { query?: string },
  results: any[]
) {
  await prisma.landlordRequest.create({
    data: {
      landlordId: userId,
      query: criteria.query || '',
      parsedCriteria: criteria as any,
      minRent: criteria.minRent,
      maxRent: criteria.maxRent,
      minLeaseDuration: criteria.minLeaseDuration,
      requiredIncome: criteria.requiredIncome,
      minCreditScore: criteria.minCreditScore,
      city: criteria.city,
      state: criteria.state,
      searchResults: results as any
    }
  })
}

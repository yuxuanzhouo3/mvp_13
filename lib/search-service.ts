/**
 * 第三方搜索服务 - 模拟搜索主流租房/求租平台
 */

import { prisma } from './db'
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
    
    // 2. 模拟搜索第三方求租平台
    let thirdPartyResults: any[] = []
    try {
      thirdPartyResults = await searchThirdPartyTenantPlatforms(criteria)
    } catch (error) {
      console.error('Third party search error:', error)
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

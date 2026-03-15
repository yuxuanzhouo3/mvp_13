import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { parseTenantQuery, parseLandlordQuery } from '@/lib/ai-service'
import { searchRentalProperties, searchTenants } from '@/lib/search-service'
import { getDatabaseAdapter, getAppRegion } from '@/lib/db-adapter'
import { prisma } from '@/lib/db'
import { deductQuota } from '@/lib/subscription-service'
import { trackAISearch } from '@/lib/analytics'

/**
 * AI对话接口 - 处理租客和房东的自然语言查询
 * 支持双版本（Supabase/CloudBase）
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

    const body = await request.json()
    const { query, userType } = body
    const isChina = getAppRegion() === 'china'

    const db = getDatabaseAdapter()
    let dbUser = null
    try {
      dbUser = await db.findUserById(user.id)
    } catch {}
    if (!dbUser && user.email) {
      try {
        dbUser = await db.findUserByEmail(user.email)
      } catch {}
    }
    if (!dbUser) {
      try {
        dbUser = await db.createUser({
          email: user.email || `${user.id}@local.user`,
          password: '',
          name: user.name || user.email?.split('@')[0] || 'User',
          userType: user.userType || 'TENANT',
        })
      } catch {}
    }
    const resolvedUserId = dbUser?.id || user.id

    if (!query) {
      return NextResponse.json(
        { error: isChina ? '查询内容不能为空' : 'Query cannot be empty' },
        { status: 400 }
      )
    }

    // 检查并扣除配额
    const quotaResult = await deductQuota(resolvedUserId, 1)
    if (!quotaResult.success) {
      return NextResponse.json(
        { error: quotaResult.message || (isChina ? '配额不足' : 'Insufficient quota') },
        { status: 403 }
      )
    }

    // 获取用户信息确认用户类型
    const actualUserType = userType || dbUser?.userType || user.userType || 'TENANT'

    if (actualUserType === 'TENANT') {
      // 租客查询房源
      try {
        const criteria = await parseTenantQuery(query)
        let results = await searchRentalProperties({ ...criteria, query }, resolvedUserId)
        let totalCount = results?.reduce((sum: number, r: any) => sum + (r.totalCount || 0), 0) || 0
        if (totalCount === 0) {
          const normalizedQuery = query.trim().toLowerCase()
          const stopwords = new Set([
            '我', '想', '需要', '找', '在', '附近', '以内', '以上', '以下', '左右', '预算', '最好', '可以', '或者', '还是', '帮我', '筛选',
            '房子', '房源', '公寓', '房屋', '租房', '租客', '房客'
          ])
          const locationAliasMap: Record<string, string[]> = {
            上海: ['shanghai'],
            北京: ['beijing'],
            广州: ['guangzhou'],
            深圳: ['shenzhen'],
            杭州: ['hangzhou'],
            南京: ['nanjing'],
            苏州: ['suzhou'],
            成都: ['chengdu'],
            重庆: ['chongqing'],
            天津: ['tianjin'],
            武汉: ['wuhan'],
            西安: ['xian', "xi'an"],
            郑州: ['zhengzhou'],
            长沙: ['changsha'],
            厦门: ['xiamen'],
            青岛: ['qingdao'],
            宁波: ['ningbo'],
            福州: ['fuzhou'],
            合肥: ['hefei'],
            昆明: ['kunming'],
            沈阳: ['shenyang'],
            大连: ['dalian'],
            哈尔滨: ['harbin']
          }
          const getLocationTokens = (value?: string) => {
            if (!value) return []
            const raw = value.trim()
            if (!raw) return []
            const lower = raw.toLowerCase()
            const tokens = new Set<string>([lower])
            const trimmed = raw.replace(/(市|省|区|县|自治区|特别行政区)$/g, '')
            if (trimmed && trimmed !== raw) tokens.add(trimmed.toLowerCase())
            Object.entries(locationAliasMap).forEach(([cn, aliases]) => {
              if (lower === cn.toLowerCase() || aliases.map((a) => a.toLowerCase()).includes(lower)) {
                tokens.add(cn.toLowerCase())
                aliases.forEach((a) => tokens.add(a.toLowerCase()))
              }
              if (trimmed && (trimmed === cn || aliases.map((a) => a.toLowerCase()).includes(trimmed.toLowerCase()))) {
                tokens.add(cn.toLowerCase())
                aliases.forEach((a) => tokens.add(a.toLowerCase()))
              }
            })
            return Array.from(tokens)
          }
          const baseTokens = normalizedQuery.split(/[\s,]+/).filter((t) => t.length > 1)
          const cjkTokens = query.match(/[\u4e00-\u9fa5]{2,}/g) || []
          const extraTokens = cjkTokens.filter((token) => !stopwords.has(token))
          const tokens = Array.from(new Set([...baseTokens, ...extraTokens]))
          let rawProperties: any[] = []
          if (isChina) {
            rawProperties = await db.query('properties', {})
          } else {
            rawProperties = await prisma.property.findMany({ take: 50 })
          }
          const matched = rawProperties.filter((p: any) => {
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
            return tokens.length > 0 ? tokens.some((token) => haystack.includes(token)) : true
          })
          const filtered = matched.filter((p: any) => {
            if (criteria.minPrice && (p.price === undefined || p.price < criteria.minPrice)) return false
            if (criteria.maxPrice && (p.price === undefined || p.price > criteria.maxPrice)) return false
            const bedrooms = p.bedrooms ?? p.bedroom ?? p.bedroomsCount
            if (criteria.exactBedrooms !== undefined) {
              if (bedrooms === undefined || bedrooms !== criteria.exactBedrooms) return false
            } else if (criteria.minBedrooms && (bedrooms === undefined || bedrooms < criteria.minBedrooms)) {
              return false
            }
            const bathrooms = p.bathrooms ?? p.bathroom ?? p.bathroomsCount
            if (criteria.minBathrooms && (bathrooms === undefined || bathrooms < criteria.minBathrooms)) return false
            if (criteria.propertyType) {
              const rawType = p.propertyType ?? p.type ?? p.listingType ?? p.category
              if (!rawType) return false
              const normalized = String(rawType).toLowerCase()
              const target = String(criteria.propertyType).toLowerCase()
              const aliasMap: Record<string, string[]> = {
                studio: ['studio', 'studio apartment', 'efficiency', '单间', '工作室'],
                apartment: ['apartment', '公寓', 'flat'],
                condo: ['condo', '复式'],
                house: ['house', '独栋', '别墅', 'villa'],
                villa: ['villa', '别墅'],
                townhouse: ['townhouse', '联排']
              }
              const aliases = aliasMap[target] || [target]
              if (!aliases.some((alias) => normalized.includes(alias.toLowerCase()))) return false
            }
            if (criteria.city || criteria.state) {
              const cityTokens = getLocationTokens(criteria.city)
              const stateTokens = getLocationTokens(criteria.state)
              const cityValue = [
                p.city,
                p.cityName,
                p.city_cn,
                p.address?.city,
                p.addressInfo?.city
              ]
                .filter(Boolean)
                .map((v: any) => String(v).toLowerCase())
                .join(' ')
              const stateValue = [
                p.state,
                p.stateName,
                p.province,
                p.provinceName,
                p.district,
                p.region,
                p.address?.state,
                p.addressInfo?.state
              ]
                .filter(Boolean)
                .map((v: any) => String(v).toLowerCase())
                .join(' ')
              if (criteria.city && cityTokens.length > 0 && !cityTokens.some((token) => cityValue.includes(token))) return false
              if (criteria.state && stateTokens.length > 0 && !stateTokens.some((token) => stateValue.includes(token))) return false
            }
            return true
          }).slice(0, 50)
          results = [{
            platform: 'RentGuard',
            platformUrl: '/',
            properties: filtered.map((p: any) => ({
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
            totalCount: filtered.length
          }]
          totalCount = filtered.length
        }

        // 埋点：AI 搜索
        await trackAISearch(resolvedUserId, query, totalCount)

        return NextResponse.json({
          success: true,
          query,
          parsedCriteria: criteria,
          results: results || [],
          message: isChina 
            ? `找到了 ${totalCount} 套匹配的房源`
            : `Found ${totalCount} matching properties`
        })
      } catch (searchError: any) {
        console.error('Search error:', searchError)
        // 即使搜索失败，也返回空结果而不是错误
        return NextResponse.json({
          success: true,
          query,
          parsedCriteria: {},
          results: [],
          message: isChina 
            ? '未找到匹配的房源，请尝试调整您的搜索条件。'
            : 'No matching properties found. Try adjusting your search criteria.'
        })
      }
    } else if (actualUserType === 'LANDLORD') {
      // 房东查询租客
      try {
        const criteria = await parseLandlordQuery(query)
        const results = await searchTenants({ ...criteria, query }, resolvedUserId)
        const totalCount = results?.length || 0

        // 埋点：AI 搜索
        await trackAISearch(resolvedUserId, query, totalCount)

        return NextResponse.json({
          success: true,
          query,
          parsedCriteria: criteria,
          results: [{
            platform: isChina ? 'RentGuard' : 'RentGuard',
            totalCount,
            tenants: results || []
          }],
          message: isChina 
            ? `找到了 ${totalCount} 位匹配的租客`
            : `Found ${totalCount} matching tenants`
        })
      } catch (searchError: any) {
        console.error('Search error:', searchError)
        // 即使搜索失败，也返回空结果而不是错误
        return NextResponse.json({
          success: true,
          query,
          parsedCriteria: {},
          results: [],
          message: isChina 
            ? '未找到租住信息，请尝试其他搜索条件。'
            : 'No matching tenants found. Try adjusting your search criteria.'
        })
      }
    } else {
      return NextResponse.json(
        { error: isChina ? '不支持的用户类型' : 'Unsupported user type' },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('AI chat error:', error)
    const isChina = getAppRegion() === 'china'
    // 返回友好的错误消息
    return NextResponse.json(
      { 
        success: false,
        error: isChina ? '查询处理失败' : 'Failed to process query', 
        details: error.message,
        results: [],
        message: isChina 
          ? '无法处理您的查询。请重试或重新组织您的搜索语言。'
          : 'Unable to process your query. Please try again or rephrase your search.'
      },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { parseTenantQuery, parseLandlordQuery } from '@/lib/ai-service'
import { searchRentalProperties, searchTenants } from '@/lib/search-service'
import { getDatabaseAdapter } from '@/lib/db-adapter'
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

    if (!query) {
      return NextResponse.json(
        { error: 'Query cannot be empty' },
        { status: 400 }
      )
    }

    // 检查并扣除配额
    const quotaResult = await deductQuota(user.id, 1)
    if (!quotaResult.success) {
      return NextResponse.json(
        { error: quotaResult.message || '配额不足' },
        { status: 403 }
      )
    }

    // 获取用户信息确认用户类型
    const db = getDatabaseAdapter()
    const dbUser = await db.findUserById(user.id)

    const actualUserType = userType || dbUser?.userType || 'TENANT'

    if (actualUserType === 'TENANT') {
      // 租客查询房源
      try {
        const criteria = await parseTenantQuery(query)
        const results = await searchRentalProperties({ ...criteria, query }, user.id)

        // 埋点：AI 搜索
        await trackAISearch(user.id, query, results?.reduce((sum: number, r: any) => sum + (r.totalCount || 0), 0) || 0)

        return NextResponse.json({
          success: true,
          query,
          parsedCriteria: criteria,
          results: results || [],
          message: `Found ${results?.reduce((sum: number, r: any) => sum + (r.totalCount || 0), 0) || 0} matching properties`
        })
      } catch (searchError: any) {
        console.error('Search error:', searchError)
        // 即使搜索失败，也返回空结果而不是错误
        return NextResponse.json({
          success: true,
          query,
          parsedCriteria: {},
          results: [],
          message: 'No matching properties found. Try adjusting your search criteria.'
        })
      }
    } else if (actualUserType === 'LANDLORD') {
      // 房东查询租客
      try {
        const criteria = await parseLandlordQuery(query)
        const results = await searchTenants({ ...criteria, query }, user.id)

        // 埋点：AI 搜索
        await trackAISearch(user.id, query, results?.length || 0)

        return NextResponse.json({
          success: true,
          query,
          parsedCriteria: criteria,
          results: results || [],
          message: `Found ${results?.length || 0} matching tenants`
        })
      } catch (searchError: any) {
        console.error('Search error:', searchError)
        // 即使搜索失败，也返回空结果而不是错误
        return NextResponse.json({
          success: true,
          query,
          parsedCriteria: {},
          results: [],
          message: 'No matching tenants found. Try adjusting your search criteria.'
        })
      }
    } else {
      return NextResponse.json(
        { error: 'Unsupported user type' },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('AI chat error:', error)
    // 返回友好的错误消息
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to process query', 
        details: error.message,
        results: [],
        message: 'Unable to process your query. Please try again or rephrase your search.'
      },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { parseTenantQuery, parseLandlordQuery } from '@/lib/ai-service'
import { searchRentalProperties, searchTenants } from '@/lib/search-service'
import { prisma } from '@/lib/db'

/**
 * AI对话接口 - 处理租客和房东的自然语言查询
 */
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request)
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

    // 获取用户信息确认用户类型
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId }
    })

    const actualUserType = userType || dbUser?.userType || 'TENANT'

    if (actualUserType === 'TENANT') {
      // 租客查询房源
      try {
        const criteria = await parseTenantQuery(query)
        const results = await searchRentalProperties({ ...criteria, query }, user.userId)

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
        const results = await searchTenants({ ...criteria, query }, user.userId)

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

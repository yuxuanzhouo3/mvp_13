import { NextRequest, NextResponse } from 'next/server'
import { searchRentalProperties } from '@/lib/search-service'
import { ParsedTenantSearchCriteria } from '@/lib/ai-service'

export const dynamic = 'force-dynamic'

/**
 * 房源搜索接口 - 使用 searchRentalProperties 统一逻辑
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const city = searchParams.get('city')
    const keyword = searchParams.get('q')
    const state = searchParams.get('state')
    const minPrice = searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined
    const maxPrice = searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined
    const minBedrooms = searchParams.get('minBedrooms') ? Number(searchParams.get('minBedrooms')) : undefined
    const minBathrooms = searchParams.get('minBathrooms') ? Number(searchParams.get('minBathrooms')) : undefined
    const petFriendly = searchParams.get('petFriendly') === 'true'

    const criteria: ParsedTenantSearchCriteria = {
      city: city || undefined,
      state: state || undefined,
      query: keyword || undefined,
      minPrice,
      maxPrice,
      minBedrooms,
      minBathrooms,
      petFriendly: petFriendly ? true : undefined
    }

    // 使用 generic user ID since this is a public search endpoint
    // In a real scenario, we might want to get the actual user ID if logged in
    const userId = 'guest-search' 

    const results = await searchRentalProperties(criteria, userId)
    
    // Flatten results from multiple platforms (currently only RentGuard supported in searchRentalProperties for now)
    const allProperties = results.flatMap(r => r.properties)

    return NextResponse.json({
      properties: allProperties,
      total: allProperties.length
    })
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json({ properties: [], total: 0 }, { status: 500 })
  }
}

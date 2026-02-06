import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getDatabaseAdapter } from '@/lib/db-adapter'

/**
 * Get all landlords (for agents to connect with)
 * 使用数据库适配器，自动根据环境变量选择数据源
 */
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const db = getDatabaseAdapter()

    // Get all landlords - 使用 query 方法查询所有用户，然后过滤
    const allUsers = await db.query('users', {}, {
      orderBy: { createdAt: 'desc' }
    })
    
    // 过滤出房东
    const landlords = allUsers.filter((user: any) => user.userType === 'LANDLORD')

    console.log(`Found ${landlords.length} landlords in database`)

    // 为每个房东获取房源数量
    const formattedLandlords = await Promise.all(
      landlords.map(async (landlord: any) => {
        try {
          // 获取该房东的房源数量
          const allProperties = await db.query('properties', {})
          const properties = allProperties.filter((p: any) => p.landlordId === landlord.id)
          
          return {
            id: landlord.id,
            name: landlord.name,
            email: landlord.email,
            phone: landlord.phone,
            propertyCount: properties.length,
            companyName: null, // CloudBase 可能没有 landlordProfile，需要单独处理
            verified: false,
            createdAt: landlord.createdAt
          }
        } catch (error: any) {
          console.error(`Error processing landlord ${landlord.id}:`, error)
          return {
            id: landlord.id,
            name: landlord.name,
            email: landlord.email,
            phone: landlord.phone,
            propertyCount: 0,
            companyName: null,
            verified: false,
            createdAt: landlord.createdAt
          }
        }
      })
    )

    console.log(`Returning ${formattedLandlords.length} formatted landlords`)

    return NextResponse.json({ landlords: formattedLandlords })
  } catch (error: any) {
    console.error('Get landlords error:', error)
    return NextResponse.json(
      { error: 'Failed to get landlords', details: error.message },
      { status: 500 }
    )
  }
}

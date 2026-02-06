import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getDatabaseAdapter } from '@/lib/db-adapter'

/**
 * Get all properties (for agents to browse and manage)
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

    // Get all available properties (agents can see all properties)
    const properties = await db.query('properties', {
      status: 'AVAILABLE'
    }, {
      orderBy: { createdAt: 'desc' }
    })
    
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
            phone: landlord.phone,
          } : null,
        }
      })
    )

    return NextResponse.json({ properties: propertiesWithLandlord })
  } catch (error: any) {
    console.error('Get agent properties error:', error)
    return NextResponse.json(
      { error: 'Failed to get properties', details: error.message },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter, getAppRegion } from '@/lib/db-adapter'

/**
 * Get all properties (for agents to browse and manage)
 * 使用数据库适配器，自动根据环境变量选择数据源
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const db = getDatabaseAdapter()
    const isChina = getAppRegion() === 'china'

    let properties: any[] = []
    if (isChina) {
      const landlordFilters: any = { userType: 'LANDLORD' }
      landlordFilters.representedById = user.id
      const landlords = await db.query('users', landlordFilters, { orderBy: { createdAt: 'desc' } })
      const landlordIds = landlords.map((l: any) => l.id)
      const agentManaged = await db.query('properties', { agentId: user.id }, { orderBy: { createdAt: 'desc' } })
      let landlordProperties: any[] = []
      if (landlordIds.length > 0) {
        const results = await Promise.all(
          landlordIds.map((lid: string) => db.query('properties', { landlordId: lid }, { orderBy: { createdAt: 'desc' } }))
        )
        landlordProperties = results.flat()
      }
      const mergedMap = new Map<string, any>()
      ;[...agentManaged, ...landlordProperties].forEach((p: any) => {
        const id = String(p.id)
        if (!mergedMap.has(id)) mergedMap.set(id, p)
      })
      properties = Array.from(mergedMap.values())
    } else {
      properties = await db.query('properties', {}, { orderBy: { createdAt: 'desc' } })
    }
    
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

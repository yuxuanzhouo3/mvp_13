import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getDatabaseAdapter, getAppRegion } from '@/lib/db-adapter'

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
    const isChina = getAppRegion() === 'china'

    // 获取与该中介建立合作关系的房东列表
    const landlordFilters: any = { userType: 'LANDLORD' }
    if (isChina) {
      landlordFilters.representedById = user.id
    } else {
      landlordFilters.landlordProfile = { representedById: user.id }
    }
    const landlords = await db.query('users', landlordFilters, { orderBy: { createdAt: 'desc' } })
    const landlordIds = landlords.map((l: any) => l.id)

    // 获取中介直接管理的房源
    const agentManaged = await db.query('properties', { agentId: user.id }, { orderBy: { createdAt: 'desc' } })

    // 获取合作房东发布的房源
    let landlordProperties: any[] = []
    if (landlordIds.length > 0) {
      if (isChina) {
        // CloudBase 不支持 in/OR 复杂查询，逐个房东查询再合并
        const results = await Promise.all(
          landlordIds.map((lid: string) => db.query('properties', { landlordId: lid }, { orderBy: { createdAt: 'desc' } }))
        )
        landlordProperties = results.flat()
      } else {
        // Prisma 支持 in 查询
        landlordProperties = await db.query('properties', { landlordId: { in: landlordIds } }, { orderBy: { createdAt: 'desc' } })
      }
    }

    // 合并房源并去重
    const mergedMap = new Map<string, any>()
    ;[...agentManaged, ...landlordProperties].forEach((p: any) => {
      const id = String(p.id)
      if (!mergedMap.has(id)) mergedMap.set(id, p)
    })
    const properties = Array.from(mergedMap.values())
    
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

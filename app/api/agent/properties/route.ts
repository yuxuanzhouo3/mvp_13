import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'

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
    const getField = (obj: any, keys: string[]) => {
      for (const key of keys) {
        const value = obj?.[key]
        if (value !== undefined && value !== null && value !== '') return value
      }
      return undefined
    }
    const getRepId = (obj: any) => {
      return (
        getField(obj, ['representedById', 'represented_by_id', 'tenant_representedById', 'tenant_represented_by_id', 'landlord_representedById', 'landlord_represented_by_id']) ??
        getField(obj?.landlordProfile, ['representedById', 'represented_by_id']) ??
        getField(obj?.tenantProfile, ['representedById', 'represented_by_id'])
      )
    }
    let agentId = user.id
    if (user.email) {
      try {
        const dbUser = await db.findUserByEmail(user.email)
        if (dbUser?.id) agentId = dbUser.id
      } catch (e) {
        agentId = user.id
      }
    }
    const agentIdSet = new Set([String(user.id), String(agentId)])

    const allUsers = await db.query('users', {}, { orderBy: { createdAt: 'desc' } })
    const representedLandlords = allUsers.filter((u: any) => {
      const type = String(u.userType || '').toUpperCase()
      if (type !== 'LANDLORD') return false
      const repId = getRepId(u)
      return agentIdSet.has(String(repId || ''))
    })
    const landlordIds = new Set(representedLandlords.map((l: any) => String(l.id)))

    const allProperties = await db.query('properties', {}, { orderBy: { createdAt: 'desc' } })
    const properties = allProperties.filter((p: any) => {
      const pid = String(getField(p, ['agentId', 'agent_id']) || '')
      const lid = String(getField(p, ['landlordId', 'landlord_id']) || '')
      return agentIdSet.has(pid) || landlordIds.has(lid)
    })
    
    // 为每个房源添加房东信息
    const propertiesWithLandlord = await Promise.all(
      properties.map(async (property: any) => {
        const landlordId = getField(property, ['landlordId', 'landlord_id'])
        const landlord = landlordId ? await db.findUserById(String(landlordId)) : null
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

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'

/**
 * Get all landlords (for agents to connect with)
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

    const allUsers = await db.query('users', {}, {
      orderBy: { createdAt: 'desc' }
    })
    const allProperties = await db.query('properties', {}, { orderBy: { createdAt: 'desc' } })
    const agentPropertyLandlordIds = new Set(
      allProperties
        .filter((p: any) => {
          const pid = String(getField(p, ['agentId', 'agent_id']) || '')
          return agentIdSet.has(pid)
        })
        .map((p: any) => String(getField(p, ['landlordId', 'landlord_id']) || ''))
        .filter(Boolean)
    )
    
    // 无论是国内版还是国际版，都只返回该中介代理的房东
    // 这样避免了"Dashboard里有房东但提交时无权限"的问题
    const landlords = allUsers.filter((u: any) => {
      const type = String(u.userType || '').toUpperCase()
      if (type !== 'LANDLORD') return false
      const repId = getRepId(u)
      const id = String(getField(u, ['id', 'userId']) || '')
      return agentIdSet.has(String(repId || '')) || (id && agentPropertyLandlordIds.has(id))
    })

    console.log(`Found ${landlords.length} landlords in database`)

    // 为每个房东获取房源数量
    const formattedLandlords = await Promise.all(
      landlords.map(async (landlord: any) => {
        try {
          // 获取该房东的房源数量
          const properties = allProperties.filter((p: any) => {
            const lid = String(getField(p, ['landlordId', 'landlord_id']) || '')
            return lid === String(landlord.id)
          })
          
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

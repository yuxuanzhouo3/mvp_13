import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'

/**
 * Get all tenants (for agents to help find homes)
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
        getField(obj?.tenantProfile, ['representedById', 'represented_by_id']) ??
        getField(obj?.landlordProfile, ['representedById', 'represented_by_id'])
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

    // Get tenants
    const allUsers = await db.query('users', {}, {
      orderBy: { createdAt: 'desc' }
    })
    const allProperties = await db.query('properties', {}, { orderBy: { createdAt: 'desc' } })
    const representedLandlordIds = new Set(
      allUsers
        .filter((u: any) => {
          const type = String(u.userType || '').toUpperCase()
          if (type !== 'LANDLORD') return false
          const repId = getRepId(u)
          return agentIdSet.has(String(repId || ''))
        })
        .map((u: any) => String(getField(u, ['id', 'userId']) || ''))
        .filter(Boolean)
    )
    const agentPropertyIds = new Set(
      allProperties
        .filter((p: any) => {
          const pid = String(getField(p, ['agentId', 'agent_id']) || '')
          const lid = String(getField(p, ['landlordId', 'landlord_id']) || '')
          return agentIdSet.has(pid) || (lid && representedLandlordIds.has(lid))
        })
        .map((p: any) => String(getField(p, ['id']) || ''))
        .filter(Boolean)
    )
    const allApplications = await db.query('applications', {}, { orderBy: { createdAt: 'desc' } })
    const relatedTenantIds = new Set(
      allApplications
        .filter((app: any) => {
          const pid = String(getField(app, ['propertyId', 'property_id']) || '')
          return pid && agentPropertyIds.has(pid)
        })
        .map((app: any) => String(getField(app, ['tenantId', 'tenant_id']) || ''))
        .filter(Boolean)
    )
    
    // 无论是国内版还是国际版，都只返回该中介代理的租客
    const tenants = allUsers.filter((t: any) => {
      const type = String(t.userType || '').toUpperCase()
      if (type !== 'TENANT') return false
      const repId = getRepId(t)
      const id = String(getField(t, ['id', 'userId']) || '')
      return agentIdSet.has(String(repId || '')) || (id && relatedTenantIds.has(id))
    })

    console.log(`Found ${tenants.length} tenants for agent ${agentId}`)

    // 格式化响应（CloudBase 可能没有 tenantProfile，需要单独处理）
    const formattedTenants = tenants.map((tenant: any) => ({
      id: tenant.id,
      name: tenant.name,
      email: tenant.email,
      phone: tenant.phone,
      createdAt: tenant.createdAt,
      tenantProfile: {
        monthlyIncome: null,
        creditScore: null,
        employmentStatus: null
      }
    }))

    return NextResponse.json({ tenants: formattedTenants })
  } catch (error: any) {
    console.error('Get tenants error:', error)
    return NextResponse.json(
      { error: 'Failed to get tenants', details: error.message },
      { status: 500 }
    )
  }
}

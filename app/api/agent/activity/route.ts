import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getAppRegion, getDatabaseAdapter } from '@/lib/db-adapter'
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase'

/**
 * Get recent activity for agent dashboard
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

    const regionIsChina = getAppRegion() === 'china'
    const db = getDatabaseAdapter()
    const authHeader = request.headers.get('authorization')
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined
    const supabaseClient = createSupabaseServerClient(accessToken)
    const supabaseReaders = [supabaseClient, supabaseAdmin].filter(Boolean) as any[]
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
    const getUserType = (obj: any) =>
      String(getField(obj, ['userType', 'user_type', 'type', 'role']) || '').toUpperCase()
    const propertyAgentFields = ['agentId', 'agent_id', 'listingAgentId', 'listing_agent_id', 'brokerId', 'broker_id']
    const propertyLandlordFields = ['landlordId', 'landlord_id', 'ownerId', 'owner_id', 'userId', 'user_id']
    let agentId = user.id
    if (user.email) {
      try {
        const dbUser = await db.findUserByEmail(user.email)
        if (dbUser?.id) agentId = dbUser.id
      } catch (e) {
        agentId = user.id
      }
    }
    if (accessToken && supabaseClient) {
      try {
        const { data } = await supabaseClient.auth.getUser(accessToken)
        if (data?.user?.id) agentId = data.user.id
      } catch {}
    }
    if (user.email && supabaseReaders.length > 0) {
      const userTables = ['User', 'user', 'users', 'profiles', 'profile', 'user_profiles', 'userProfiles']
      for (const client of supabaseReaders) {
        for (const tableName of userTables) {
          const { data, error } = await client
            .from(tableName)
            .select('id,email')
            .ilike('email', user.email)
            .limit(1)
          if (!error && data && data.length > 0) {
            agentId = data[0].id
            break
          }
        }
        if (agentId && String(agentId) !== String(user.id)) break
      }
    }
    const agentIdSet = new Set([String(user.id), String(agentId)])

    const fetchProfileMap = async (tableNames: string[]) => {
      const profileMap = new Map<string, any>()
      if (supabaseReaders.length === 0) return profileMap
      for (const client of supabaseReaders) {
        for (const tableName of tableNames) {
          const { data, error } = await client
            .from(tableName)
            .select('*')
          if (!error && data) {
            data.forEach((row: any) => {
              const uid = row.userId ?? row.user_id
              if (uid) profileMap.set(String(uid), row)
            })
            if (profileMap.size > 0) return profileMap
          }
        }
      }
      return profileMap
    }
    const fetchUsersFromSupabase = async () => {
      if (supabaseReaders.length === 0) return []
      const userTables = ['User', 'user', 'users', 'profiles', 'profile', 'user_profiles', 'userProfiles']
      const landlordProfiles = ['landlordProfiles', 'landlord_profiles', 'LandlordProfile', 'landlordProfile']
      const tenantProfiles = ['tenantProfiles', 'tenant_profiles', 'TenantProfile', 'tenantProfile']
      const landlordProfileMap = await fetchProfileMap(landlordProfiles)
      const tenantProfileMap = await fetchProfileMap(tenantProfiles)
      for (const client of supabaseReaders) {
        for (const tableName of userTables) {
          const { data, error } = await client
            .from(tableName)
            .select('*')
          if (!error && data) {
            return (data || []).map((row: any) => ({
              ...row,
              landlordProfile: landlordProfileMap.get(String(row.id)),
              tenantProfile: tenantProfileMap.get(String(row.id)),
            }))
          }
        }
      }
      return []
    }
    const fetchTableFromSupabase = async (tableNames: string[]) => {
      if (supabaseReaders.length === 0) return []
      for (const client of supabaseReaders) {
        for (const tableName of tableNames) {
          const { data, error } = await client
            .from(tableName)
            .select('*')
          if (!error && data) return data || []
        }
      }
      return []
    }

    let allUsers: any[] = []
    let allProperties: any[] = []
    let allApplications: any[] = []
    let allMessages: any[] = []
    try {
      allUsers = await db.query('users', {}, { orderBy: { createdAt: 'desc' } })
      allProperties = await db.query('properties', {}, { orderBy: { createdAt: 'desc' } })
      allApplications = await db.query('applications', {}, { orderBy: { createdAt: 'desc' } })
      allMessages = await db.query('messages', {}, { orderBy: { createdAt: 'desc' } })
    } catch (error) {
      allUsers = await fetchUsersFromSupabase()
      allProperties = await fetchTableFromSupabase(['Property', 'property', 'properties', 'Listing', 'listing', 'listings'])
      allApplications = await fetchTableFromSupabase(['Application', 'application', 'applications'])
      allMessages = await fetchTableFromSupabase(['Message', 'message', 'messages'])
    }
    const representedLandlords = allUsers.filter((u: any) => {
      const type = getUserType(u)
      if (type !== 'LANDLORD') return false
      const repId = getRepId(u)
      return agentIdSet.has(String(repId || ''))
    })
    const landlordIdSet = new Set(representedLandlords.map((l: any) => String(getField(l, ['id', 'userId', 'user_id']) || l.id)))
    const scopedProperties = allProperties.filter((p: any) => {
      const pid = String(getField(p, propertyAgentFields) || '')
      const lid = String(getField(p, propertyLandlordFields) || '')
      return agentIdSet.has(pid) || landlordIdSet.has(lid)
    })
    const propertyIds = [...new Set(scopedProperties.map((p: any) => String(getField(p, ['id', '_id', 'propertyId', 'property_id']) || '')).filter(Boolean))]
    const userNameMap = new Map(
      allUsers.map((u: any) => {
        const id = String(getField(u, ['id', 'userId', 'user_id']) || '')
        const name = u.name || u.email || ''
        return [id, name]
      })
    )
    const propertyTitleMap = new Map(
      scopedProperties.map((p: any) => {
        const id = String(getField(p, ['id', '_id', 'propertyId', 'property_id']) || '')
        const title = p.title || p.address || ''
        return [id, title]
      })
    )

    // Recent applications related to the agent's properties
    let recentApplications: any[] = []
    if (propertyIds.length > 0) {
      recentApplications = allApplications.filter((app: any) => {
        const pid = String(getField(app, ['propertyId', 'property_id']) || '')
        return propertyIds.includes(pid)
      })
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
    }

    // Recent messages for the agent
    let recentMessages: any[] = []
    recentMessages = allMessages.filter((m: any) => {
      const sender = String(getField(m, ['senderId', 'sender_id']) || '')
      const receiver = String(getField(m, ['receiverId', 'receiver_id']) || '')
      return agentIdSet.has(sender) || agentIdSet.has(receiver)
    })
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)

    const toRelativeTime = (date: Date) => {
      const diffMs = Date.now() - new Date(date).getTime()
      const diffMin = Math.floor(diffMs / 60000)
      const diffHr = Math.floor(diffMin / 60)
      const diffDay = Math.floor(diffHr / 24)
      if (regionIsChina) {
        if (diffMin < 1) return '刚刚'
        if (diffMin < 60) return `${diffMin} 分钟前`
        if (diffHr < 24) return `${diffHr} 小时前`
        return `${diffDay} 天前`
      } else {
        if (diffMin < 1) return 'just now'
        if (diffMin < 60) return `${diffMin} minutes ago`
        if (diffHr < 24) return `${diffHr} hours ago`
        return `${diffDay} days ago`
      }
    }

    const mapStatus = (status?: string) => {
      const s = (status || '').toUpperCase()
      if (regionIsChina) {
        switch (s) {
          case 'APPROVED': return '已批准'
          case 'PENDING': return '待审核'
          case 'REJECTED': return '已拒绝'
          case 'WITHDRAWN': return '已撤回'
          case 'UNDER_REVIEW': return '审核中'
          case 'READ': return '已读'
          case 'UNREAD': return '未读'
          default: return '状态'
        }
      } else {
        return s ? s.toLowerCase() : 'pending'
      }
    }

    // Format activities
    const activitiesRaw = [
      ...recentApplications.map(app => ({
        type: 'application' as const,
        message: regionIsChina
          ? `${(app.tenant?.name || app.tenantName || userNameMap.get(String(getField(app, ['tenantId', 'tenant_id']) || '')) || '租客')} 申请了 ${(app.property?.title || app.propertyTitle || propertyTitleMap.get(String(getField(app, ['propertyId', 'property_id']) || '')) || '房源')}`
          : `${(app.tenant?.name || app.tenantName || userNameMap.get(String(getField(app, ['tenantId', 'tenant_id']) || '')) || 'A tenant')} applied for ${(app.property?.title || app.propertyTitle || propertyTitleMap.get(String(getField(app, ['propertyId', 'property_id']) || '')) || 'a property')}`,
        time: toRelativeTime(app.createdAt),
        status: mapStatus(app.status),
        timestamp: new Date(app.createdAt).getTime(),
      })),
      ...recentMessages.map(msg => ({
        type: 'message' as const,
        message: regionIsChina
          ? `来自 ${(msg.sender?.name || msg.senderName || userNameMap.get(String(getField(msg, ['senderId', 'sender_id']) || '')) || '某人')} 的新消息`
          : `New message from ${(msg.sender?.name || msg.senderName || userNameMap.get(String(getField(msg, ['senderId', 'sender_id']) || '')) || 'someone')}`,
        time: toRelativeTime(msg.createdAt),
        status: mapStatus(msg.isRead ? 'READ' : 'UNREAD'),
        timestamp: new Date(msg.createdAt).getTime(),
      }))
    ]

    const activities = activitiesRaw
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5)
      .map(({ timestamp, ...rest }) => rest)

    return NextResponse.json({ activities })
  } catch (error: any) {
    console.error('Get activity error:', error)
    return NextResponse.json(
      { error: 'Failed to get activity', details: error.message },
      { status: 500 }
    )
  }
}

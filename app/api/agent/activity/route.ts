import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getAppRegion, getDatabaseAdapter } from '@/lib/db-adapter'

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

    const allUsers = await db.query('users', {}, { orderBy: { createdAt: 'desc' } })
    const representedLandlords = allUsers.filter((u: any) => {
      const type = String(u.userType || '').toUpperCase()
      if (type !== 'LANDLORD') return false
      const repId = getRepId(u)
      return agentIdSet.has(String(repId || ''))
    })
    const landlordIdSet = new Set(representedLandlords.map((l: any) => String(l.id)))
    const allProperties = await db.query('properties', {}, { orderBy: { createdAt: 'desc' } })
    const scopedProperties = allProperties.filter((p: any) => {
      const pid = String(getField(p, ['agentId', 'agent_id']) || '')
      const lid = String(getField(p, ['landlordId', 'landlord_id']) || '')
      return agentIdSet.has(pid) || landlordIdSet.has(lid)
    })
    const propertyIds = [...new Set(scopedProperties.map((p: any) => String(getField(p, ['id']) || '')).filter(Boolean))]
    const userNameMap = new Map(
      allUsers.map((u: any) => {
        const id = String(getField(u, ['id', 'userId']) || '')
        const name = u.name || u.email || ''
        return [id, name]
      })
    )
    const propertyTitleMap = new Map(
      scopedProperties.map((p: any) => {
        const id = String(getField(p, ['id']) || '')
        const title = p.title || p.address || ''
        return [id, title]
      })
    )

    // Recent applications related to the agent's properties
    let recentApplications: any[] = []
    if (propertyIds.length > 0) {
      const allApplications = await db.query('applications', {}, { orderBy: { createdAt: 'desc' } })
      recentApplications = allApplications.filter((app: any) => {
        const pid = String(getField(app, ['propertyId', 'property_id']) || '')
        return propertyIds.includes(pid)
      })
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
    }

    // Recent messages for the agent
    let recentMessages: any[] = []
    const allMessages = await db.query('messages', {}, { orderBy: { createdAt: 'desc' } })
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

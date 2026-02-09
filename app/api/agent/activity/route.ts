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
    const uid = user.id

    let propertyIds: string[] = []
    if (regionIsChina) {
      const landlordFilters: any = { userType: 'LANDLORD' }
      landlordFilters.representedById = uid
      const landlords = await db.query('users', landlordFilters, { orderBy: { createdAt: 'desc' } })
      const landlordIds = landlords.map((l: any) => l.id)
      const agentManaged = await db.query('properties', { agentId: uid }, { orderBy: { createdAt: 'desc' } })
      let landlordProps: any[] = []
      if (landlordIds.length > 0) {
        const results = await Promise.all(
          landlordIds.map((lid: string) => db.query('properties', { landlordId: lid }, { orderBy: { createdAt: 'desc' } }))
        )
        landlordProps = results.flat()
      }
      propertyIds = [...new Set([...agentManaged, ...landlordProps].map((p: any) => String(p.id)))]
    } else {
      const allProperties = await db.query('properties', {}, { orderBy: { createdAt: 'desc' } })
      propertyIds = [...new Set(allProperties.map((p: any) => String(p.id)))]
    }

    // Recent applications related to the agent's properties
    let recentApplications: any[] = []
    if (propertyIds.length > 0) {
      if (regionIsChina) {
        const appResults = await Promise.all(
          propertyIds.map((pid: string) => db.query('applications', { propertyId: pid }, { orderBy: { createdAt: 'desc' } }))
        )
        recentApplications = appResults.flat()
      } else {
        recentApplications = await db.query('applications', { propertyId: { in: propertyIds } }, { orderBy: { createdAt: 'desc' }, take: 10 })
      }
      recentApplications = recentApplications
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
    }

    // Recent messages for the agent
    let recentMessages: any[] = []
    if (regionIsChina) {
      const [sent, received] = await Promise.all([
        db.query('messages', { senderId: uid }, { orderBy: { createdAt: 'desc' } }),
        db.query('messages', { receiverId: uid }, { orderBy: { createdAt: 'desc' } }),
      ])
      recentMessages = [...sent, ...received]
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
    } else {
      recentMessages = await db.query('messages', {}, { orderBy: { createdAt: 'desc' }, take: 5 })
    }

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
          ? `${(app.tenant?.name || app.tenantName || '租客')} 申请了 ${(app.property?.title || app.propertyTitle || '房源')}`
          : `${(app.tenant?.name || app.tenantName || 'A tenant')} applied for ${(app.property?.title || app.propertyTitle || 'a property')}`,
        time: toRelativeTime(app.createdAt),
        status: mapStatus(app.status),
        timestamp: new Date(app.createdAt).getTime(),
      })),
      ...recentMessages.map(msg => ({
        type: 'message' as const,
        message: regionIsChina
          ? `来自 ${(msg.sender?.name || msg.senderName || '某人')} 的新消息`
          : `New message from ${(msg.sender?.name || msg.senderName || 'someone')}`,
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

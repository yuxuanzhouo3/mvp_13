import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getAppRegion } from '@/lib/db-adapter'

/**
 * Get recent activity for agent dashboard
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

    const regionIsChina = getAppRegion() === 'china'

    // Get recent applications
    const recentApplications = await prisma.application.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: {
          select: { name: true }
        },
        property: {
          select: { title: true }
        }
      }
    })

    // Get recent messages
    const recentMessages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: user.userId },
          { receiverId: user.userId }
        ]
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: { name: true }
        }
      }
    })

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
          ? `${app.tenant?.name || '租客'} 申请了 ${app.property?.title || '房源'}`
          : `${app.tenant?.name || 'A tenant'} applied for ${app.property?.title || 'a property'}`,
        time: toRelativeTime(app.createdAt),
        status: mapStatus(app.status),
        timestamp: new Date(app.createdAt).getTime(),
      })),
      ...recentMessages.map(msg => ({
        type: 'message' as const,
        message: regionIsChina
          ? `来自 ${msg.sender?.name || '某人'} 的新消息`
          : `New message from ${msg.sender?.name || 'someone'}`,
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

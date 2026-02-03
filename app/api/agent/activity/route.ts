import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

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

    // Format activities
    const activities = [
      ...recentApplications.map(app => ({
        type: 'application',
        message: `${app.tenant?.name || 'A tenant'} applied for ${app.property?.title || 'a property'}`,
        time: new Date(app.createdAt).toLocaleString(),
        status: app.status?.toLowerCase() || 'pending'
      })),
      ...recentMessages.map(msg => ({
        type: 'message',
        message: `New message from ${msg.sender?.name || 'someone'}`,
        time: new Date(msg.createdAt).toLocaleString(),
        status: msg.isRead ? 'read' : 'unread'
      }))
    ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 5)

    return NextResponse.json({ activities })
  } catch (error: any) {
    console.error('Get activity error:', error)
    return NextResponse.json(
      { error: 'Failed to get activity', details: error.message },
      { status: 500 }
    )
  }
}

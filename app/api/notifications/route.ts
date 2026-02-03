import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * Get notifications for current user
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

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    const where: any = {
      userId: user.userId
    }

    if (unreadOnly) {
      where.isRead = false
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    return NextResponse.json({ notifications })
  } catch (error: any) {
    console.error('Get notifications error:', error)
    return NextResponse.json(
      { error: 'Failed to get notifications', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Mark notification as read
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { notificationId, markAllAsRead } = body

    if (markAllAsRead) {
      await prisma.notification.updateMany({
        where: {
          userId: user.userId,
          isRead: false
        },
        data: {
          isRead: true
        }
      })
    } else if (notificationId) {
      await prisma.notification.update({
        where: {
          id: notificationId,
          userId: user.userId
        },
        data: {
          isRead: true
        }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Update notification error:', error)
    return NextResponse.json(
      { error: 'Failed to update notification', details: error.message },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'

/**
 * Get notifications for current user
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

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    const db = getDatabaseAdapter()
    
    // Construct query
    // Note: DB adapter might not support complex where clauses in query() yet depending on implementation
    // But typically it supports simple object matching
    const query: any = {
      userId: user.id
    }
    
    if (unreadOnly) {
      query.isRead = false
    }

    // Use db.query which should handle finding multiple records
    // Assuming 'notifications' collection exists
    const notifications = await db.query('notifications', query)

    // Sort in memory if DB adapter doesn't support sort
    notifications.sort((a: any, b: any) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    return NextResponse.json({ notifications: notifications.slice(0, 50) })
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
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { notificationId, markAllAsRead } = body
    const db = getDatabaseAdapter()

    if (markAllAsRead) {
      // Get all unread notifications for user
      const unread = await db.query('notifications', { userId: user.id, isRead: false })
      
      // Update them one by one (as updateMany might not be supported by all adapters)
      await Promise.all(unread.map((n: any) => 
        db.update('notifications', n.id, { isRead: true })
      ))
    } else if (notificationId) {
      await db.update('notifications', notificationId, { isRead: true })
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

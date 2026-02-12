import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { createDatabaseAdapter, getDatabaseAdapter } from '@/lib/db-adapter'
import { supabaseAdmin } from '@/lib/supabase'

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
    const isConnectionError = (error: any) => {
      const msg = String(error?.message || '').toLowerCase()
      return msg.includes('server has closed the connection') ||
        msg.includes('connection') ||
        msg.includes('timeout') ||
        msg.includes('pool') ||
        msg.includes('maxclients')
    }
    let tokenUserId: string | null = null
    const authHeader = request.headers.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ') && supabaseAdmin) {
      const token = authHeader.substring(7)
      try {
        const { data } = await supabaseAdmin.auth.getUser(token)
        if (data?.user?.id) {
          tokenUserId = String(data.user.id)
        }
      } catch {}
    }
    
    const query: any = {
      userId: user.id
    }
    
    if (unreadOnly) {
      query.isRead = false
    }

    let notifications: any[] = []
    try {
      notifications = await db.query('notifications', query)
    } catch (error: any) {
      if (isConnectionError(error)) {
        const fallbackDb = createDatabaseAdapter('china')
        const userIds = new Set<string>([String(user.id)])
        if (tokenUserId) userIds.add(String(tokenUserId))
        if (user.email) {
          try {
            const fallbackUser = await fallbackDb.findUserByEmail(user.email)
            if (fallbackUser?.id) {
              userIds.add(String(fallbackUser.id))
            }
          } catch {}
        }
        const allNotifications = await fallbackDb.query('notifications', {}, { orderBy: { createdAt: 'desc' } })
        notifications = allNotifications.filter((n: any) => userIds.has(String(n.userId || n.user_id || '')))
        if (unreadOnly) {
          notifications = notifications.filter((n: any) => n.isRead === false || n.is_read === false)
        }
        notifications.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        return NextResponse.json({ notifications: notifications.slice(0, 50) })
      }
      if (!supabaseAdmin) {
        return NextResponse.json({ notifications: [] })
      }
      const normalizeNotification = (n: any) => ({
        ...n,
        userId: n.userId ?? n.user_id,
        isRead: n.isRead ?? n.is_read,
        createdAt: n.createdAt ?? n.created_at,
      })
      const tableNames = ['Notification', 'notification', 'notifications']
      const userFields = ['userId', 'user_id']
      const readFields = ['isRead', 'is_read']
      const orderFields = ['createdAt', 'created_at']
      let lastError: any = null
      for (const tableName of tableNames) {
        for (const userField of userFields) {
          for (const readField of readFields) {
            for (const orderField of orderFields) {
              let supabaseQuery = supabaseAdmin
                .from(tableName)
                .select('*')
                .eq(userField, user.id)
                .order(orderField, { ascending: false })
                .limit(50)
              if (unreadOnly) {
                supabaseQuery = supabaseQuery.eq(readField, false)
              }
              const { data, error: sbError } = await supabaseQuery
              if (!sbError) {
                return NextResponse.json({ notifications: (data || []).map(normalizeNotification) })
              }
              lastError = sbError
            }
          }
        }
      }
      if (lastError) {
        for (const tableName of tableNames) {
          let supabaseQuery = supabaseAdmin
            .from(tableName)
            .select('*')
            .limit(50)
          const { data, error: sbError } = await supabaseQuery
          if (!sbError) {
            return NextResponse.json({ notifications: (data || []).map(normalizeNotification) })
          }
          lastError = sbError
        }
      }
      return NextResponse.json({ notifications: [] })
    }

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
      let unread: any[] = []
      try {
        unread = await db.query('notifications', { userId: user.id, isRead: false })
      } catch (error: any) {
        const msg = String(error?.message || '').toLowerCase()
        if (
          msg.includes('server has closed the connection') ||
          msg.includes('connection') ||
          msg.includes('timeout') ||
          msg.includes('pool') ||
          msg.includes('maxclients') ||
          msg.includes('pooler') ||
          msg.includes('p1001') ||
          msg.includes('p1017') ||
          msg.includes('p1000')
        ) {
          if (!supabaseAdmin) {
            return NextResponse.json({ success: true })
          }
          const tableNames = ['Notification', 'notification', 'notifications']
          let ids: any[] = []
          let lastError: any = null
          for (const tableName of tableNames) {
            const { data, error: sbError } = await supabaseAdmin
              .from(tableName)
              .select('id')
              .eq('userId', user.id)
              .eq('isRead', false)
            if (!sbError) {
              ids = (data || []).map((n: any) => n.id).filter(Boolean)
              if (ids.length > 0) {
                const { error: updateError } = await supabaseAdmin
                  .from(tableName)
                  .update({ isRead: true })
                  .in('id', ids)
                if (updateError) {
                  lastError = updateError
                } else {
                  lastError = null
                }
              }
              break
            }
            lastError = sbError
          }
          if (lastError) {
            throw lastError
          }
          return NextResponse.json({ success: true })
        }
        throw error
      }
      
      // Update them one by one (as updateMany might not be supported by all adapters)
      await Promise.all(unread.map((n: any) => 
        db.update('notifications', n.id, { isRead: true })
      ))
    } else if (notificationId) {
      try {
        await db.update('notifications', notificationId, { isRead: true })
      } catch (error: any) {
        const msg = String(error?.message || '').toLowerCase()
        if (
          msg.includes('server has closed the connection') ||
          msg.includes('connection') ||
          msg.includes('timeout') ||
          msg.includes('pool') ||
          msg.includes('maxclients') ||
          msg.includes('pooler') ||
          msg.includes('p1001') ||
          msg.includes('p1017') ||
          msg.includes('p1000')
        ) {
          if (supabaseAdmin) {
            const tableNames = ['Notification', 'notification', 'notifications']
            let lastError: any = null
            for (const tableName of tableNames) {
              const { error: updateError } = await supabaseAdmin
                .from(tableName)
                .update({ isRead: true })
                .eq('id', notificationId)
              if (!updateError) {
                lastError = null
                break
              }
              lastError = updateError
            }
            if (lastError) {
              throw lastError
            }
          }
        } else {
          throw error
        }
      }
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

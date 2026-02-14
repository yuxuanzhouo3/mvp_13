import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase'

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
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined
    const supabaseClient = createSupabaseServerClient(accessToken)
    const supabaseReaders = [supabaseClient, supabaseAdmin].filter(Boolean) as any[]
    if (accessToken && supabaseClient) {
      try {
        const { data } = await supabaseClient.auth.getUser(accessToken)
        if (data?.user?.id) {
          tokenUserId = String(data.user.id)
        }
      } catch {}
    }
    if (!tokenUserId && accessToken && supabaseAdmin) {
      try {
        const { data } = await supabaseAdmin.auth.getUser(accessToken)
        if (data?.user?.id) {
          tokenUserId = String(data.user.id)
        }
      } catch {}
    }
    const userIdsForQuery: string[] = [String(user.id)]
    if (tokenUserId && !userIdsForQuery.includes(tokenUserId)) {
      userIdsForQuery.push(tokenUserId)
    }
    if (user.email && supabaseReaders.length > 0) {
      const userTables = ['User', 'user', 'users']
      for (const client of supabaseReaders) {
        for (const tableName of userTables) {
          const { data, error } = await client
            .from(tableName)
            .select('id,email')
            .ilike('email', user.email)
            .limit(1)
          if (!error && data && data.length > 0) {
            const foundId = String(data[0].id)
            if (foundId && !userIdsForQuery.includes(foundId)) {
              userIdsForQuery.push(foundId)
            }
            break
          }
        }
        if (userIdsForQuery.length > 1) break
      }
    }
    
    const query: any = {
      userId: user.id
    }
    
    if (unreadOnly) {
      query.isRead = false
    }

    let notifications: any[] = []
    const fetchFromSupabase = async () => {
      if (supabaseReaders.length === 0) {
        return null
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
      for (const client of supabaseReaders) {
        for (const tableName of tableNames) {
          for (const userField of userFields) {
            for (const readField of readFields) {
              for (const orderField of orderFields) {
                let supabaseQuery = client
                  .from(tableName)
                  .select('*')
                  .order(orderField, { ascending: false })
                  .limit(50)
                if (userIdsForQuery.length > 1) {
                  supabaseQuery = supabaseQuery.in(userField, userIdsForQuery)
                } else {
                  supabaseQuery = supabaseQuery.eq(userField, userIdsForQuery[0])
                }
                if (unreadOnly) {
                  supabaseQuery = supabaseQuery.eq(readField, false)
                }
                const { data, error: sbError } = await supabaseQuery
                if (!sbError) {
                  return (data || []).map(normalizeNotification)
                }
                lastError = sbError
              }
            }
          }
        }
        if (!lastError) break
      }
      if (lastError) {
        for (const client of supabaseReaders) {
          for (const tableName of tableNames) {
            let supabaseQuery = client
              .from(tableName)
              .select('*')
              .limit(50)
            const { data, error: sbError } = await supabaseQuery
            if (!sbError) {
              return (data || []).map(normalizeNotification)
            }
            lastError = sbError
          }
        }
      }
      if (lastError) {
        console.warn('Supabase notifications fallback failed:', lastError)
      }
      return null
    }
    try {
      notifications = await db.query('notifications', query)
    } catch (error: any) {
      if (isConnectionError(error)) {
        const supabaseNotifications = await fetchFromSupabase()
        if (supabaseNotifications) {
          supabaseNotifications.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          return NextResponse.json({ notifications: supabaseNotifications.slice(0, 50) })
        }
        return NextResponse.json({ notifications: [] })
      }
      const supabaseNotifications = await fetchFromSupabase()
      if (supabaseNotifications) {
        return NextResponse.json({ notifications: supabaseNotifications.slice(0, 50) })
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
    const authHeader = request.headers.get('authorization')
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined
    const supabaseClient = createSupabaseServerClient(accessToken)
    const supabaseReaders = [supabaseClient, supabaseAdmin].filter(Boolean) as any[]

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
          if (supabaseReaders.length === 0) {
            return NextResponse.json({ success: true })
          }
          const tableNames = ['Notification', 'notification', 'notifications']
          let ids: any[] = []
          let lastError: any = null
          for (const client of supabaseReaders) {
            for (const tableName of tableNames) {
              const { data, error: sbError } = await client
                .from(tableName)
                .select('id')
                .eq('userId', user.id)
                .eq('isRead', false)
              if (!sbError) {
                ids = (data || []).map((n: any) => n.id).filter(Boolean)
                if (ids.length > 0) {
                  const { error: updateError } = await client
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
            if (!lastError) break
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
          if (supabaseReaders.length > 0) {
            const tableNames = ['Notification', 'notification', 'notifications']
            let lastError: any = null
            for (const client of supabaseReaders) {
              for (const tableName of tableNames) {
                const { error: updateError } = await client
                  .from(tableName)
                  .update({ isRead: true })
                  .eq('id', notificationId)
                if (!updateError) {
                  lastError = null
                  break
                }
                lastError = updateError
              }
              if (!lastError) break
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

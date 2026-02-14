import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase'

/**
 * Get unread messages count
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
    const authHeader = request.headers.get('authorization')
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined
    const supabaseClient = createSupabaseServerClient(accessToken)
    const supabaseReaders = [supabaseClient, supabaseAdmin].filter(Boolean) as any[]
    let userId = user.id
    if (user.email) {
      try {
        const dbUser = await db.findUserByEmail(user.email)
        if (dbUser?.id) userId = dbUser.id
      } catch (e) {
        userId = user.id
      }
    }
    if (accessToken && supabaseClient) {
      try {
        const { data } = await supabaseClient.auth.getUser(accessToken)
        if (data?.user?.id) userId = data.user.id
      } catch {}
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
            userId = data[0].id
            break
          }
        }
        if (userId && String(userId) !== String(user.id)) break
      }
    }
    const userIdSet = new Set([String(user.id), String(userId)])
    let allMessages: any[] = []
    try {
      allMessages = await db.query('messages', {})
    } catch (error) {
      if (supabaseReaders.length > 0) {
        const messageTables = ['Message', 'message', 'messages']
        for (const client of supabaseReaders) {
          for (const tableName of messageTables) {
            const { data, error } = await client
              .from(tableName)
              .select('*')
            if (!error && data) {
              allMessages = data || []
              break
            }
          }
          if (allMessages.length > 0) break
        }
      }
    }
    const count = allMessages.filter((m: any) => {
      const receiver = String(m.receiverId || m.receiver_id || '')
      const isUnread = m.isRead === false || m.isRead === null || m.isRead === undefined || m.is_read === false
      return userIdSet.has(receiver) && isUnread
    }).length

    return NextResponse.json({ count })
  } catch (error: any) {
    console.error('Get unread count error:', error)
    return NextResponse.json(
      { error: 'Failed to get unread count', details: error.message },
      { status: 500 }
    )
  }
}

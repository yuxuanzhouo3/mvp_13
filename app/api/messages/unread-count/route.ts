import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase'

/**
 * Get unread messages count
 */
export async function GET(request: NextRequest) {
  try {
    const timeoutMarker = Symbol('unread-timeout')
    const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T | typeof timeoutMarker> => {
      return await Promise.race([
        promise,
        new Promise<typeof timeoutMarker>((resolve) => setTimeout(() => resolve(timeoutMarker), timeoutMs))
      ])
    }
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
    const supabaseReaders = [supabaseAdmin, supabaseClient].filter(Boolean) as any[]
    let userId = user.id
    if (user.email) {
      try {
        const dbUserResult = await withTimeout(db.findUserByEmail(user.email), 1200)
        const dbUser = dbUserResult === timeoutMarker ? null : dbUserResult
        if (dbUser?.id) userId = dbUser.id
      } catch (e) {
        userId = user.id
      }
    }
    if (accessToken && supabaseClient) {
      try {
        const tokenResult = await withTimeout(supabaseClient.auth.getUser(accessToken), 1200)
        if (tokenResult !== timeoutMarker && (tokenResult as any)?.data?.user?.id) userId = (tokenResult as any).data.user.id
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
    let count = 0
    const idList = Array.from(userIdSet).filter(Boolean)
    try {
      const [byCamelResult, bySnakeResult] = await Promise.all([
        withTimeout(db.query('messages', { receiverId: idList.length === 1 ? idList[0] : { in: idList }, isRead: false }), 2500),
        withTimeout(db.query('messages', { receiver_id: idList.length === 1 ? idList[0] : { in: idList }, is_read: false }), 2500),
      ])
      const byCamel = byCamelResult === timeoutMarker ? [] : (Array.isArray(byCamelResult) ? byCamelResult : [])
      const bySnake = bySnakeResult === timeoutMarker ? [] : (Array.isArray(bySnakeResult) ? bySnakeResult : [])
      const seen = new Set<string>()
      ;[...byCamel, ...bySnake].forEach((msg: any) => {
        const key = String(msg.id || msg._id || `${msg.senderId || msg.sender_id}_${msg.receiverId || msg.receiver_id}_${msg.createdAt || msg.created_at || ''}`)
        if (!seen.has(key)) seen.add(key)
      })
      count = seen.size
    } catch {}

    if (count === 0 && supabaseReaders.length > 0) {
      const messageTables = ['Message', 'messages', 'message']
      const adminClients = supabaseReaders.map((client) => client as any)
      for (const client of adminClients) {
        for (const tableName of messageTables) {
          const byCamel = await withTimeout(
            client.from(tableName).select('id', { count: 'exact', head: true }).in('receiverId', idList).eq('isRead', false),
            1500
          )
          if (byCamel !== timeoutMarker && !(byCamel as any)?.error && typeof (byCamel as any)?.count === 'number') {
            count += Number((byCamel as any).count || 0)
          }
          const bySnake = await withTimeout(
            client.from(tableName).select('id', { count: 'exact', head: true }).in('receiver_id', idList).eq('is_read', false),
            1500
          )
          if (bySnake !== timeoutMarker && !(bySnake as any)?.error && typeof (bySnake as any)?.count === 'number') {
            count += Number((bySnake as any).count || 0)
          }
          if (count > 0) break
        }
        if (count > 0) break
      }
    }

    return NextResponse.json({ count })
  } catch (error: any) {
    console.error('Get unread count error:', error)
    return NextResponse.json(
      { error: 'Failed to get unread count', details: error.message },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'

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
    let userId = user.id
    if (user.email) {
      try {
        const dbUser = await db.findUserByEmail(user.email)
        if (dbUser?.id) userId = dbUser.id
      } catch (e) {
        userId = user.id
      }
    }
    const userIdSet = new Set([String(user.id), String(userId)])
    const allMessages = await db.query('messages', {})
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

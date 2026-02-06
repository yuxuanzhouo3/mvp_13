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
    const messages = await db.query('messages', {
      receiverId: user.id
    })
    const count = messages.filter((m: any) => {
      const isUnread = m.isRead === false || m.isRead === null || m.isRead === undefined || m.is_read === false
      return isUnread
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

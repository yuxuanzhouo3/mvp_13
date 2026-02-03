import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * Get unread messages count
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

    const count = await prisma.message.count({
      where: {
        receiverId: user.userId,
        isRead: false
      }
    })

    return NextResponse.json({ count })
  } catch (error: any) {
    console.error('Get unread count error:', error)
    return NextResponse.json(
      { error: 'Failed to get unread count', details: error.message },
      { status: 500 }
    )
  }
}

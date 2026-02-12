import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * Debug endpoint to check messages in database
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get current user info
    const currentUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { id: true, name: true, email: true, userType: true }
    })

    // Get all users
    const allUsers = await prisma.user.findMany({
      select: { id: true, name: true, email: true, userType: true }
    })

    // Get all messages (limited)
    const allMessages = await prisma.message.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, name: true, email: true } },
        receiver: { select: { id: true, name: true, email: true } }
      }
    })

    // Get messages for current user
    const myMessages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: user.userId },
          { receiverId: user.userId }
        ]
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, name: true, email: true } },
        receiver: { select: { id: true, name: true, email: true } }
      }
    })

    return NextResponse.json({
      currentUser,
      tokenUserId: user.userId,
      allUsers,
      totalMessagesInDb: allMessages.length,
      allMessages: allMessages.map(m => ({
        id: m.id,
        senderId: m.senderId,
        senderName: m.sender.name,
        receiverId: m.receiverId,
        receiverName: m.receiver.name,
        content: m.content.substring(0, 100),
        createdAt: m.createdAt
      })),
      myMessagesCount: myMessages.length,
      myMessages: myMessages.map(m => ({
        id: m.id,
        senderId: m.senderId,
        senderName: m.sender.name,
        receiverId: m.receiverId,
        receiverName: m.receiver.name,
        content: m.content.substring(0, 100),
        createdAt: m.createdAt
      }))
    })
  } catch (error: any) {
    console.error('Debug error:', error)
    return NextResponse.json(
      { error: 'Debug failed', details: error.message },
      { status: 500 }
    )
  }
}

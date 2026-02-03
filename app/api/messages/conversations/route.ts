import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * Get conversations list for current user
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

    // Get all unique conversations from messages
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: user.userId },
          { receiverId: user.userId }
        ]
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            userType: true,
            avatar: true
          }
        },
        receiver: {
          select: {
            id: true,
            name: true,
            email: true,
            userType: true,
            avatar: true
          }
        },
        property: {
          select: {
            id: true,
            title: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Group by conversation partner
    const conversationsMap = new Map()
    const partnerIds = new Set<string>()
    
    messages.forEach((msg) => {
      const partnerId = msg.senderId === user.userId ? msg.receiverId : msg.senderId
      const partner = msg.senderId === user.userId ? msg.receiver : msg.sender
      
      if (!conversationsMap.has(partnerId)) {
        partnerIds.add(partnerId)
        conversationsMap.set(partnerId, {
          id: partnerId,
          name: partner.name,
          email: partner.email,
          role: partner.userType,
          avatar: partner.avatar,
          lastMessage: msg.content,
          time: msg.createdAt,
          unread: 0,
          property: msg.property
        })
      }
    })

    // Get unread counts for all partners
    if (partnerIds.size > 0) {
      const unreadCounts = await prisma.message.groupBy({
        by: ['senderId'],
        where: {
          senderId: { in: Array.from(partnerIds) },
          receiverId: user.userId,
          isRead: false
        },
        _count: true
      })

      unreadCounts.forEach((count) => {
        const conversation = conversationsMap.get(count.senderId)
        if (conversation) {
          conversation.unread = count._count
        }
      })
    }

    const conversations = Array.from(conversationsMap.values())

    return NextResponse.json({ conversations })
  } catch (error: any) {
    console.error('Get conversations error:', error)
    return NextResponse.json(
      { error: 'Failed to get conversations', details: error.message },
      { status: 500 }
    )
  }
}

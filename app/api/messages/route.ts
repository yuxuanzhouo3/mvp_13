import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * Get messages for current user
 */
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      console.log('GET /api/messages - Unauthorized: No valid token')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const partnerId = searchParams.get('partnerId') || searchParams.get('userId')

    console.log('GET /api/messages:', { 
      currentUserId: user.userId, 
      partnerId,
      url: request.url 
    })

    let messages

    if (partnerId) {
      // Get messages between current user and partner
      messages = await prisma.message.findMany({
        where: {
          OR: [
            { senderId: user.userId, receiverId: partnerId },
            { senderId: partnerId, receiverId: user.userId }
          ]
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          receiver: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      })

      // Mark received messages as read
      if (messages.length > 0) {
        await prisma.message.updateMany({
          where: {
            senderId: partnerId,
            receiverId: user.userId,
            isRead: false
          },
          data: { isRead: true }
        })
      }
    } else {
      // Get all messages for current user
      messages = await prisma.message.findMany({
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
              email: true
            }
          },
          receiver: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      })
    }

    console.log('GET /api/messages - Found:', messages.length, 'messages')
    
    // Log first few messages for debugging
    if (messages.length > 0) {
      console.log('Sample messages:', messages.slice(0, 3).map(m => ({
        id: m.id,
        senderId: m.senderId,
        receiverId: m.receiverId,
        content: m.content.substring(0, 50)
      })))
    }

    return NextResponse.json({ messages })
  } catch (error: any) {
    console.error('GET /api/messages error:', error)
    return NextResponse.json(
      { error: 'Failed to get messages', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Send a message
 */
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      console.log('POST /api/messages - Unauthorized: No valid token')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { receiverId, propertyId, content } = body

    console.log('POST /api/messages:', { 
      senderId: user.userId, 
      receiverId, 
      content: content?.substring(0, 50),
      propertyId 
    })

    if (!receiverId || !content) {
      console.log('POST /api/messages - Missing required fields')
      return NextResponse.json(
        { error: 'Receiver ID and content are required' },
        { status: 400 }
      )
    }

    // Verify sender exists
    const sender = await prisma.user.findUnique({
      where: { id: user.userId }
    })

    if (!sender) {
      console.log('POST /api/messages - Sender not found:', user.userId)
      return NextResponse.json(
        { error: 'Sender not found' },
        { status: 404 }
      )
    }

    // Verify receiver exists
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId }
    })

    if (!receiver) {
      console.log('POST /api/messages - Receiver not found:', receiverId)
      return NextResponse.json(
        { error: 'Receiver not found' },
        { status: 404 }
      )
    }

    // Create the message
    const message = await prisma.message.create({
      data: {
        senderId: user.userId,
        receiverId,
        propertyId: propertyId || null,
        content,
        isRead: false
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        receiver: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    console.log('POST /api/messages - Created message:', {
      id: message.id,
      senderId: message.senderId,
      receiverId: message.receiverId
    })

    return NextResponse.json({ message })
  } catch (error: any) {
    console.error('POST /api/messages error:', error)
    return NextResponse.json(
      { error: 'Failed to send message', details: error.message },
      { status: 500 }
    )
  }
}

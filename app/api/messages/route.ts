import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'
import { trackEvent } from '@/lib/analytics'

/**
 * Get messages for current user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
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
      currentUserId: user.id, 
      partnerId,
      url: request.url 
    })

    const db = getDatabaseAdapter()
    let messages = await db.query('messages', {})

    if (partnerId) {
      // Get messages between current user and partner
      messages = messages.filter((m: any) => 
        (m.senderId === user.id && m.receiverId === partnerId) ||
        (m.senderId === partnerId && m.receiverId === user.id)
      )

      // Mark received messages as read
      const unreadMessages = messages.filter((m: any) => 
        m.senderId === partnerId && m.receiverId === user.id && !m.isRead
      )
      for (const msg of unreadMessages) {
        await db.update('messages', msg.id, { isRead: true })
      }
    } else {
      // Get all messages for current user
      messages = messages.filter((m: any) => 
        m.senderId === user.id || m.receiverId === user.id
      )
    }

    // 排序
    messages.sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt).getTime()
      const dateB = new Date(b.createdAt).getTime()
      return dateA - dateB
    })

    // 加载关联数据
    const messagesWithRelations = await Promise.all(
      messages.map(async (msg: any) => {
        const [sender, receiver] = await Promise.all([
          db.findUserById(msg.senderId),
          db.findUserById(msg.receiverId),
        ])
        return {
          ...msg,
          sender: sender ? {
            id: sender.id,
            name: sender.name,
            email: sender.email,
          } : null,
          receiver: receiver ? {
            id: receiver.id,
            name: receiver.name,
            email: receiver.email,
          } : null,
        }
      })
    )

    console.log('GET /api/messages - Found:', messagesWithRelations.length, 'messages')
    
    // Log first few messages for debugging
    if (messagesWithRelations.length > 0) {
      console.log('Sample messages:', messagesWithRelations.slice(0, 3).map(m => ({
        id: m.id,
        senderId: m.senderId,
        receiverId: m.receiverId,
        content: m.content.substring(0, 50)
      })))
    }

    return NextResponse.json({ messages: messagesWithRelations })
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
    const user = await getCurrentUser(request)
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
      senderId: user.id, 
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

    const db = getDatabaseAdapter()

    // Verify sender exists
    const sender = await db.findUserById(user.id)
    if (!sender) {
      console.log('POST /api/messages - Sender not found:', user.id)
      return NextResponse.json(
        { error: 'Sender not found' },
        { status: 404 }
      )
    }

    // Verify receiver exists
    const receiver = await db.findUserById(receiverId)
    if (!receiver) {
      console.log('POST /api/messages - Receiver not found:', receiverId)
      return NextResponse.json(
        { error: 'Receiver not found' },
        { status: 404 }
      )
    }

    // Create the message
    const message = await db.create('messages', {
      senderId: user.id,
      receiverId,
      propertyId: propertyId || null,
      content,
      isRead: false,
    })

    // 加载关联数据
    const messageWithRelations = {
      ...message,
      sender: {
        id: sender.id,
        name: sender.name,
        email: sender.email,
      },
      receiver: {
        id: receiver.id,
        name: receiver.name,
        email: receiver.email,
      },
    }

    // 埋点
    await trackEvent({
      type: 'MESSAGE_SEND',
      userId: user.id,
      metadata: { messageId: message.id, receiverId, propertyId },
    })

    console.log('POST /api/messages - Created message:', {
      id: message.id,
      senderId: message.senderId,
      receiverId: message.receiverId
    })

    return NextResponse.json({ message: messageWithRelations })
  } catch (error: any) {
    console.error('POST /api/messages error:', error)
    return NextResponse.json(
      { error: 'Failed to send message', details: error.message },
      { status: 500 }
    )
  }
}

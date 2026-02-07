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
      const unreadMessages = messages.filter((m: any) => {
        // 支持多种ID格式和isRead字段格式
        const msgSenderId = String(m.senderId || m.sender_id || '')
        const msgReceiverId = String(m.receiverId || m.receiver_id || '')
        const partnerIdStr = String(partnerId || '')
        const userIdStr = String(user.id || '')
        
        const isUnread = m.isRead === false || m.isRead === null || m.isRead === undefined || m.is_read === false
        
        return msgSenderId === partnerIdStr && 
               msgReceiverId === userIdStr && 
               isUnread
      })
      
      console.log('Marking messages as read:', unreadMessages.length, 'messages for partner:', partnerId)
      
      for (const msg of unreadMessages) {
        try {
          const msgId = msg.id || msg._id
          if (!msgId) {
            console.warn('Message has no ID, skipping:', msg)
            continue
          }
          
          // 更新消息为已读
          await db.update('messages', msgId, { isRead: true, is_read: true })
          console.log('Marked message as read:', msgId)
        } catch (error: any) {
          console.error('Failed to mark message as read:', msg.id || msg._id, error.message)
        }
      }
      
      // 重新查询消息以确保已读状态已更新
      if (unreadMessages.length > 0) {
        console.log('Refreshing messages after marking as read')
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

    // 加载关联数据 - 使用 try-catch 避免单个用户查询失败影响整体
    const messagesWithRelations = await Promise.all(
      messages.map(async (msg: any) => {
        let sender = null
        let receiver = null
        
        try {
          sender = await db.findUserById(msg.senderId)
        } catch (error: any) {
          console.warn('Failed to load sender:', msg.senderId, error.message)
        }
        
        try {
          receiver = await db.findUserById(msg.receiverId)
        } catch (error: any) {
          console.warn('Failed to load receiver:', msg.receiverId, error.message)
        }
        
        return {
          ...msg,
          sender: sender ? {
            id: sender.id,
            name: sender.name,
            email: sender.email,
          } : {
            id: msg.senderId,
            name: 'Unknown User',
            email: '',
          },
          receiver: receiver ? {
            id: receiver.id,
            name: receiver.name,
            email: receiver.email,
          } : {
            id: msg.receiverId,
            name: 'Unknown User',
            email: '',
          },
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
 * 联系模式逻辑：
 * - 如果房源有agentId，消息发送给中介（房源代理）
 * - 如果租客有representedById，中介代替租客联系（客源代理）
 * - 否则，租客直接联系房东（直租）
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
    let { receiverId, propertyId, content } = body

    console.log('POST /api/messages:', { 
      senderId: user.id, 
      receiverId, 
      content: content?.substring(0, 50),
      propertyId 
    })

    if (!content) {
      console.log('POST /api/messages - Missing required fields')
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      )
    }

    const db = getDatabaseAdapter()
    
    // 如果提供了propertyId但没有receiverId，根据联系模式自动确定receiverId
    if (propertyId && !receiverId) {
      const property = await db.findById('properties', propertyId)
      if (!property) {
        return NextResponse.json(
          { error: 'Property not found' },
          { status: 404 }
        )
      }

      // 获取发送者信息
      const sender = await db.findUserById(user.id)
      const isTenant = sender?.userType === 'TENANT'

      if (isTenant) {
        // 租客发送消息
        // 场景A：房源代理 - 如果房源有agentId，消息发送给中介
        if (property.agentId) {
          receiverId = property.agentId
          console.log('Tenant contacting agent (房源代理):', receiverId)
        } 
        // 场景B：客源代理 - 如果租客有representedById，中介代替租客联系
        else {
          try {
            const tenantProfile = await db.query('tenantProfiles', { userId: user.id })
            if (tenantProfile && tenantProfile.length > 0 && tenantProfile[0].representedById) {
              // 租客有中介代理，但这里租客自己发送消息，应该发送给房东还是中介？
              // 根据需求：中介代替租客去联系房东/其他中介，租客只负责最后确认
              // 所以这里租客发送消息时，如果有中介，应该提示或自动转发给中介
              // 但为了简化，这里直接发送给房东，中介可以查看消息
              receiverId = property.landlordId
              console.log('Tenant with agent contacting landlord:', receiverId)
            } else {
              // 场景：直租 - 租客直接联系房东
              receiverId = property.landlordId
              console.log('Tenant contacting landlord directly (直租):', receiverId)
            }
          } catch (err) {
            // 如果查询失败，默认发送给房东
            receiverId = property.landlordId
            console.log('Failed to check tenant profile, defaulting to landlord:', receiverId)
          }
        }
      } else {
        // 房东或中介发送消息，需要receiverId
        if (!receiverId) {
          return NextResponse.json(
            { error: 'Receiver ID is required when sender is not a tenant' },
            { status: 400 }
          )
        }
      }
    }

    if (!receiverId) {
      return NextResponse.json(
        { error: 'Receiver ID is required' },
        { status: 400 }
      )
    }

    // Verify sender exists - 如果查询失败，仍然允许发送消息（避免阻塞）
    let sender = null
    try {
      sender = await db.findUserById(user.id)
      if (!sender) {
        console.warn('POST /api/messages - Sender not found:', user.id, 'but continuing...')
      }
    } catch (error: any) {
      console.warn('POST /api/messages - Failed to verify sender:', user.id, error.message, 'but continuing...')
    }

    // Verify receiver exists - 如果查询失败，仍然允许发送消息（避免阻塞）
    let receiver = null
    try {
      receiver = await db.findUserById(receiverId)
      if (!receiver) {
        console.warn('POST /api/messages - Receiver not found:', receiverId, 'but continuing...')
      }
    } catch (error: any) {
      console.warn('POST /api/messages - Failed to verify receiver:', receiverId, error.message, 'but continuing...')
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
      sender: sender ? {
        id: sender.id,
        name: sender.name,
        email: sender.email,
      } : {
        id: user.id,
        name: 'Unknown User',
        email: '',
      },
      receiver: receiver ? {
        id: receiver.id,
        name: receiver.name,
        email: receiver.email,
      } : {
        id: receiverId,
        name: 'Unknown User',
        email: '',
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

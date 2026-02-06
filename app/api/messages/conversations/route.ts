import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'

/**
 * Get conversations list for current user
 * 使用数据库适配器，自动根据环境变量选择数据源
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

    // Get all unique conversations from messages
    const allMessages = await db.query('messages', {})
    const messages = allMessages.filter((m: any) => 
      m.senderId === user.id || m.receiverId === user.id
    ).sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt).getTime()
      const dateB = new Date(b.createdAt).getTime()
      return dateB - dateA // 降序排列
    })

    // Group by conversation partner
    const conversationsMap = new Map()
    const partnerIds = new Set<string>()
    
    for (const msg of messages) {
      const partnerId = msg.senderId === user.id ? msg.receiverId : msg.senderId
      
      if (!conversationsMap.has(partnerId)) {
        partnerIds.add(partnerId)
        const partner = await db.findUserById(partnerId)
        
        if (partner) {
          // Get property if exists
          let property = null
          if (msg.propertyId) {
            try {
              property = await db.findById('properties', msg.propertyId)
            } catch (e) {
              // Property might not exist, ignore
            }
          }
          
          conversationsMap.set(partnerId, {
            id: partnerId,
            name: partner.name,
            email: partner.email,
            role: partner.userType,
            avatar: partner.avatar,
            lastMessage: msg.content,
            time: msg.createdAt,
            unread: 0,
            property: property ? { id: property.id, title: property.title } : null
          })
        }
      }
    }

    // Get unread counts for all partners - 重新查询所有消息以确保获取最新状态
    const allMessagesForUnread = await db.query('messages', {})
    const currentUserMessages = allMessagesForUnread.filter((m: any) => 
      m.senderId === user.id || m.receiverId === user.id
    )
    
    for (const partnerId of partnerIds) {
      const unreadMessages = currentUserMessages.filter((m: any) => {
        // 支持多种ID格式和isRead字段格式
        const msgSenderId = String(m.senderId || m.sender_id || '')
        const msgReceiverId = String(m.receiverId || m.receiver_id || '')
        const partnerIdStr = String(partnerId || '')
        const userIdStr = String(user.id || '')
        
        // 检查是否为未读消息（支持多种字段名）
        const isUnread = m.isRead === false || 
                        m.isRead === null || 
                        m.isRead === undefined || 
                        m.is_read === false ||
                        m.is_read === null ||
                        m.is_read === undefined
        
        return msgSenderId === partnerIdStr && 
               msgReceiverId === userIdStr && 
               isUnread
      })
      
      const conversation = conversationsMap.get(partnerId)
      if (conversation) {
        conversation.unread = unreadMessages.length
        console.log('Unread count for partner', partnerId, ':', unreadMessages.length, 'out of', currentUserMessages.length, 'total messages')
      }
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

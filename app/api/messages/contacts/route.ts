import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'
import { prisma } from '@/lib/db'

/**
 * Get all available contacts for messaging
 * - Includes users who have sent messages to current user
 * - Returns last message for each contact
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

    const region = process.env.NEXT_PUBLIC_APP_REGION || 'global'
    const db = getDatabaseAdapter()

    const isConnectionError = (error: any) => {
      const msg = String(error?.message || '').toLowerCase()
      return msg.includes('server has closed the connection') ||
        msg.includes('connection') ||
        msg.includes('timeout') ||
        msg.includes('pool') ||
        msg.includes('maxclients')
    }

    const runWithRetry = async <T,>(fn: () => Promise<T>): Promise<T> => {
      try {
        return await fn()
      } catch (error: any) {
        if (!isConnectionError(error)) {
          throw error
        }
        try {
          await prisma.$disconnect()
        } catch {}
        try {
          await prisma.$connect()
        } catch {}
        return await fn()
      }
    }

    if (region === 'global') {
      const currentUser = await runWithRetry(() => prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          name: true,
          email: true,
          userType: true,
          avatar: true
        }
      }))

      if (!currentUser) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }

      const contactsMap = new Map()

      const allMyMessages = (await runWithRetry(() => prisma.message.findMany({
        where: {
          OR: [
            { senderId: user.id },
            { receiverId: user.id }
          ]
        },
        select: {
          id: true,
          senderId: true,
          receiverId: true,
          content: true,
          createdAt: true,
          isRead: true
        }
      }))).sort((a: any, b: any) => {
        const dateA = new Date(a.createdAt).getTime()
        const dateB = new Date(b.createdAt).getTime()
        return dateB - dateA
      })

      const lastMessageByPartner = new Map<string, any>()
      allMyMessages.forEach((msg: any) => {
        const partnerId = msg.senderId === user.id ? msg.receiverId : msg.senderId
        if (!lastMessageByPartner.has(partnerId)) {
          lastMessageByPartner.set(partnerId, msg)
        }
      })

      for (const [partnerId, msg] of lastMessageByPartner.entries()) {
        const partner = await runWithRetry(() => prisma.user.findUnique({
          where: { id: partnerId },
          select: {
            id: true,
            name: true,
            email: true,
            userType: true,
            avatar: true
          }
        }))
        if (partner && partner.id !== user.id && !contactsMap.has(partner.id)) {
          const unreadMessages = allMyMessages.filter((m: any) =>
            m.senderId === partnerId && m.receiverId === user.id && !m.isRead
          )
          contactsMap.set(partner.id, {
            id: partner.id,
            name: partner.name,
            email: partner.email,
            role: partner.userType,
            avatar: partner.avatar,
            lastMessage: msg.content,
            time: msg.createdAt,
            unread: unreadMessages.length
          })
        }
      }

      if (currentUser.userType === 'LANDLORD') {
        const properties = await runWithRetry(() => prisma.property.findMany({
          where: { landlordId: user.id },
          select: { id: true, title: true, landlordId: true }
        }))
        const propertyIds = properties.map((p) => p.id)
        if (propertyIds.length > 0) {
          const applications = await runWithRetry(() => prisma.application.findMany({
            where: { propertyId: { in: propertyIds } },
            select: { tenantId: true, propertyId: true }
          }))
          for (const app of applications) {
            const tenant = await runWithRetry(() => prisma.user.findUnique({
              where: { id: app.tenantId },
              select: { id: true, name: true, email: true, userType: true, avatar: true }
            }))
            if (tenant && !contactsMap.has(tenant.id)) {
              const property = properties.find((p) => p.id === app.propertyId)
              contactsMap.set(tenant.id, {
                id: tenant.id,
                name: tenant.name,
                email: tenant.email,
                role: tenant.userType,
                avatar: tenant.avatar,
                property: property ? { id: property.id, title: property.title } : null,
                lastMessage: "",
                time: null,
                unread: 0
              })
            }
          }
        }
      } else if (currentUser.userType === 'TENANT') {
        const applications = await runWithRetry(() => prisma.application.findMany({
          where: { tenantId: user.id },
          select: { propertyId: true }
        }))
        for (const app of applications) {
          const property = await runWithRetry(() => prisma.property.findUnique({
            where: { id: app.propertyId },
            select: { id: true, title: true, landlordId: true }
          }))
          if (property && property.landlordId) {
            const landlord = await runWithRetry(() => prisma.user.findUnique({
              where: { id: property.landlordId },
              select: { id: true, name: true, email: true, userType: true, avatar: true }
            }))
            if (landlord && !contactsMap.has(landlord.id)) {
              contactsMap.set(landlord.id, {
                id: landlord.id,
                name: landlord.name,
                email: landlord.email,
                role: landlord.userType,
                avatar: landlord.avatar,
                property: { id: property.id, title: property.title },
                lastMessage: "",
                time: null,
                unread: 0
              })
            }
          }
        }

        const savedProperties = await runWithRetry(() => prisma.savedProperty.findMany({
          where: { userId: user.id },
          select: { propertyId: true }
        }))
        for (const saved of savedProperties) {
          const property = await runWithRetry(() => prisma.property.findUnique({
            where: { id: saved.propertyId },
            select: { id: true, title: true, landlordId: true }
          }))
          if (property && property.landlordId) {
            const landlord = await runWithRetry(() => prisma.user.findUnique({
              where: { id: property.landlordId },
              select: { id: true, name: true, email: true, userType: true, avatar: true }
            }))
            if (landlord && !contactsMap.has(landlord.id)) {
              contactsMap.set(landlord.id, {
                id: landlord.id,
                name: landlord.name,
                email: landlord.email,
                role: landlord.userType,
                avatar: landlord.avatar,
                property: { id: property.id, title: property.title },
                lastMessage: "",
                time: null,
                unread: 0
              })
            }
          }
        }
      } else if (currentUser.userType === 'AGENT') {
        const allUsers = await runWithRetry(() => prisma.user.findMany({
          where: {
            userType: { in: ['LANDLORD', 'TENANT'] },
            NOT: { id: user.id }
          },
          select: { id: true, name: true, email: true, userType: true, avatar: true }
        }))
        for (const u of allUsers) {
          if (!contactsMap.has(u.id)) {
            contactsMap.set(u.id, {
              id: u.id,
              name: u.name || u.email || 'Unknown',
              email: u.email || '',
              role: u.userType,
              avatar: u.avatar,
              lastMessage: "",
              time: null,
              unread: 0
            })
          }
        }
      }

      if (contactsMap.size === 0) {
        const otherUsers = await runWithRetry(() => prisma.user.findMany({
          where: { NOT: { id: currentUser.id } },
          select: { id: true, name: true, email: true, userType: true, avatar: true }
        }))
        for (const u of otherUsers) {
          contactsMap.set(u.id, {
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.userType,
            avatar: u.avatar,
            lastMessage: "",
            time: null,
            unread: 0
          })
        }
      }

      const contacts = Array.from(contactsMap.values()).sort((a, b) => {
        if (a.time && b.time) {
          return new Date(b.time).getTime() - new Date(a.time).getTime()
        }
        if (a.time) return -1
        if (b.time) return 1
        return 0
      })

      return NextResponse.json({ contacts })
    }

    const currentUser = await db.findUserById(user.id)

    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const contactsMap = new Map()

    // Get all messages involving current user to find last messages
    const allMessages = await db.query('messages', {})
    const allMyMessages = allMessages.filter((m: any) => 
      m.senderId === user.id || m.receiverId === user.id
    ).sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt).getTime()
      const dateB = new Date(b.createdAt).getTime()
      return dateB - dateA // 降序排列
    })

    // Group messages by partner and get the last one
    const lastMessageByPartner = new Map<string, any>()
    allMyMessages.forEach((msg: any) => {
      const partnerId = msg.senderId === user.id ? msg.receiverId : msg.senderId
      if (!lastMessageByPartner.has(partnerId)) {
        lastMessageByPartner.set(partnerId, msg)
      }
    })

    // Add message partners to contacts with last message
    for (const [partnerId, msg] of lastMessageByPartner.entries()) {
      const partner = await db.findUserById(partnerId)
      if (partner && partner.id !== user.id && !contactsMap.has(partner.id)) {
        // Count unread messages from this partner
        const unreadMessages = allMyMessages.filter((m: any) => 
          m.senderId === partnerId && m.receiverId === user.id && !m.isRead
        )
        
        contactsMap.set(partner.id, {
          id: partner.id,
          name: partner.name,
          email: partner.email,
          role: partner.userType,
          avatar: partner.avatar,
          lastMessage: msg.content,
          time: msg.createdAt,
          unread: unreadMessages.length
        })
      }
    }

    // Add role-specific contacts that don't have messages yet
    if (currentUser.userType === 'LANDLORD') {
      const allProperties = await db.query('properties', {})
      const properties = allProperties.filter((p: any) => p.landlordId === user.id)
      const propertyIds = properties.map((p: any) => p.id)

      if (propertyIds.length > 0) {
        const allApplications = await db.query('applications', {})
        const applications = allApplications.filter((app: any) => 
          propertyIds.includes(app.propertyId)
        )

        for (const app of applications) {
          const tenant = await db.findUserById(app.tenantId)
          if (tenant && !contactsMap.has(tenant.id)) {
            const property = properties.find((p: any) => p.id === app.propertyId)
            contactsMap.set(tenant.id, {
              id: tenant.id,
              name: tenant.name,
              email: tenant.email,
              role: tenant.userType,
              avatar: tenant.avatar,
              property: property ? { id: property.id, title: property.title } : null,
              lastMessage: "",
              time: null,
              unread: 0
            })
          }
        }
      }

    } else if (currentUser.userType === 'TENANT') {
      // Get applications by tenant
      const allApplications = await db.query('applications', {})
      const applications = allApplications.filter((app: any) => app.tenantId === user.id)

      for (const app of applications) {
        const property = await db.findById('properties', app.propertyId)
        if (property && property.landlordId) {
          const landlord = await db.findUserById(property.landlordId)
          if (landlord && !contactsMap.has(landlord.id)) {
            contactsMap.set(landlord.id, {
              id: landlord.id,
              name: landlord.name,
              email: landlord.email,
              role: landlord.userType,
              avatar: landlord.avatar,
              property: { id: property.id, title: property.title },
              lastMessage: "",
              time: null,
              unread: 0
            })
          }
        }
      }

      // Get saved properties
      const allSavedProperties = await db.query('savedProperties', {})
      const savedProperties = allSavedProperties.filter((saved: any) => saved.userId === user.id)

      for (const saved of savedProperties) {
        const property = await db.findById('properties', saved.propertyId)
        if (property && property.landlordId) {
          const landlord = await db.findUserById(property.landlordId)
          if (landlord && !contactsMap.has(landlord.id)) {
            contactsMap.set(landlord.id, {
              id: landlord.id,
              name: landlord.name,
              email: landlord.email,
              role: landlord.userType,
              avatar: landlord.avatar,
              property: { id: property.id, title: property.title },
              lastMessage: "",
              time: null,
              unread: 0
            })
          }
        }
      }

    } else if (currentUser.userType === 'AGENT') {
      // For agents, show all landlords and tenants
      console.log('Fetching contacts for AGENT user:', user.id)
      const allUsers = await db.query('users', {})
      console.log('Total users found:', allUsers.length)
      
      const relevantUsers = allUsers.filter((u: any) => {
        const userId = u.id || u._id
        const userType = u.userType || u.user_type
        const isRelevant = (userType === 'LANDLORD' || userType === 'TENANT') && userId !== user.id
        return isRelevant
      })

      console.log('Relevant users (LANDLORD/TENANT):', relevantUsers.length)

      for (const u of relevantUsers) {
        const userId = u.id || u._id
        if (userId && !contactsMap.has(userId)) {
          contactsMap.set(userId, {
            id: userId,
            name: u.name || u.email || 'Unknown',
            email: u.email || '',
            role: u.userType || u.user_type || 'USER',
            avatar: u.avatar || null,
            lastMessage: "",
            time: null,
            unread: 0
          })
        }
      }
      
      console.log('Contacts map size after adding AGENT contacts:', contactsMap.size)
    }

    // If still no contacts, show all other users
    if (contactsMap.size === 0) {
      const allUsers = await db.query('users', {})
      const otherUsers = allUsers.filter((u: any) => u.id !== currentUser.id)

      for (const u of otherUsers) {
        contactsMap.set(u.id, {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.userType,
          avatar: u.avatar,
          lastMessage: "",
          time: null,
          unread: 0
        })
      }
    }

    // Sort contacts: those with messages first (by time), then others
    const contacts = Array.from(contactsMap.values()).sort((a, b) => {
      if (a.time && b.time) {
        return new Date(b.time).getTime() - new Date(a.time).getTime()
      }
      if (a.time) return -1
      if (b.time) return 1
      return 0
    })

    return NextResponse.json({ contacts })
  } catch (error: any) {
    console.error('Get contacts error:', error)
    return NextResponse.json(
      { error: 'Failed to get contacts', details: error.message },
      { status: 500 }
    )
  }
}

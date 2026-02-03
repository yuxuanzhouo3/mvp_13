import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * Get all available contacts for messaging
 * - Includes users who have sent messages to current user
 * - Returns last message for each contact
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

    const currentUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { id: true, userType: true }
    })

    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const contactsMap = new Map()

    // Get all messages involving current user to find last messages
    const allMyMessages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: user.userId },
          { receiverId: user.userId }
        ]
      },
      orderBy: { createdAt: 'desc' },
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
        }
      }
    })

    // Group messages by partner and get the last one
    const lastMessageByPartner = new Map<string, any>()
    allMyMessages.forEach(msg => {
      const partnerId = msg.senderId === user.userId ? msg.receiverId : msg.senderId
      if (!lastMessageByPartner.has(partnerId)) {
        lastMessageByPartner.set(partnerId, msg)
      }
    })

    // Add message partners to contacts with last message
    lastMessageByPartner.forEach((msg, partnerId) => {
      const partner = msg.senderId === user.userId ? msg.receiver : msg.sender
      if (partner.id !== user.userId && !contactsMap.has(partner.id)) {
        contactsMap.set(partner.id, {
          id: partner.id,
          name: partner.name,
          email: partner.email,
          role: partner.userType,
          avatar: partner.avatar,
          lastMessage: msg.content,
          time: msg.createdAt,
          unread: 0
        })
      }
    })

    // Count unread messages per sender
    const unreadCounts = await prisma.message.groupBy({
      by: ['senderId'],
      where: {
        receiverId: user.userId,
        isRead: false
      },
      _count: true
    })

    unreadCounts.forEach(count => {
      const contact = contactsMap.get(count.senderId)
      if (contact) {
        contact.unread = count._count
      }
    })

    // Add role-specific contacts that don't have messages yet
    if (currentUser.userType === 'LANDLORD') {
      const properties = await prisma.property.findMany({
        where: { landlordId: user.userId },
        select: { id: true }
      })
      const propertyIds = properties.map(p => p.id)

      if (propertyIds.length > 0) {
        const applications = await prisma.application.findMany({
          where: { propertyId: { in: propertyIds } },
          include: {
            tenant: {
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
          }
        })

        applications.forEach(app => {
          if (!contactsMap.has(app.tenant.id)) {
            contactsMap.set(app.tenant.id, {
              id: app.tenant.id,
              name: app.tenant.name,
              email: app.tenant.email,
              role: app.tenant.userType,
              avatar: app.tenant.avatar,
              property: app.property,
              lastMessage: "",
              time: null,
              unread: 0
            })
          }
        })
      }

    } else if (currentUser.userType === 'TENANT') {
      const applications = await prisma.application.findMany({
        where: { tenantId: user.userId },
        include: {
          property: {
            include: {
              landlord: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  userType: true,
                  avatar: true
                }
              }
            }
          }
        }
      })

      const savedProperties = await prisma.savedProperty.findMany({
        where: { userId: user.userId },
        include: {
          property: {
            include: {
              landlord: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  userType: true,
                  avatar: true
                }
              }
            }
          }
        }
      })

      applications.forEach(app => {
        if (app.property?.landlord && !contactsMap.has(app.property.landlord.id)) {
          contactsMap.set(app.property.landlord.id, {
            id: app.property.landlord.id,
            name: app.property.landlord.name,
            email: app.property.landlord.email,
            role: app.property.landlord.userType,
            avatar: app.property.landlord.avatar,
            property: { id: app.property.id, title: app.property.title },
            lastMessage: "",
            time: null,
            unread: 0
          })
        }
      })
      savedProperties.forEach(saved => {
        if (saved.property?.landlord && !contactsMap.has(saved.property.landlord.id)) {
          contactsMap.set(saved.property.landlord.id, {
            id: saved.property.landlord.id,
            name: saved.property.landlord.name,
            email: saved.property.landlord.email,
            role: saved.property.landlord.userType,
            avatar: saved.property.landlord.avatar,
            property: { id: saved.property.id, title: saved.property.title },
            lastMessage: "",
            time: null,
            unread: 0
          })
        }
      })

    } else if (currentUser.userType === 'AGENT') {
      const allUsers = await prisma.user.findMany({
        where: {
          userType: { in: ['LANDLORD', 'TENANT'] },
          id: { not: user.userId }
        },
        select: {
          id: true,
          name: true,
          email: true,
          userType: true,
          avatar: true
        }
      })

      allUsers.forEach(u => {
        if (!contactsMap.has(u.id)) {
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
      })
    }

    // If still no contacts, show all other users
    if (contactsMap.size === 0) {
      const allUsers = await prisma.user.findMany({
        where: { id: { not: currentUser.id } },
        select: {
          id: true,
          name: true,
          email: true,
          userType: true,
          avatar: true
        }
      })

      allUsers.forEach(u => {
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
      })
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

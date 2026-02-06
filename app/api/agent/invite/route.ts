import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    const region = process.env.NEXT_PUBLIC_APP_REGION || 'global'
    if (!user || user.userType !== 'AGENT') {
      return NextResponse.json({ error: region === 'china' ? '无权限' : 'Unauthorized' }, { status: 401 })
    }

    const { email } = await request.json()
    if (!email) {
      return NextResponse.json({ error: region === 'china' ? '请输入邮箱' : 'Email is required' }, { status: 400 })
    }

    const db = getDatabaseAdapter()
    
    // Check if user exists
    // Note: findUserByEmail returns UnifiedUser. For checking existence it is fine.
    const existingUser = await db.findUserByEmail(email)

    if (!existingUser) {
      // User does not exist - Send Invitation Email (Mocked)
      const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/signup?ref=${user.id}&email=${encodeURIComponent(email)}`
      
      // In a real application, you would send an email here using a service like Resend or SendGrid
      console.log(`[Invite] Sending invitation to ${email} from agent ${user.id}. Link: ${inviteLink}`)
      
      return NextResponse.json({ 
        message: region === 'china' ? '邀请已发送' : 'Invitation sent successfully', 
        status: 'invited',
        inviteLink 
      })
    }

    // User exists
    if (existingUser.userType !== 'TENANT') {
      return NextResponse.json({ error: region === 'china' ? '该用户不是租客' : 'User exists but is not a tenant' }, { status: 400 })
    }

    // Check if already has agent
    // existingUser.representedById is populated now in db-adapter
    if (existingUser.representedById) {
      if (existingUser.representedById === user.id) {
        return NextResponse.json({ message: region === 'china' ? '该用户已是您的客户' : 'User is already your client', status: 'already_bound' })
      } else {
        return NextResponse.json({ error: region === 'china' ? '该用户已绑定其他中介' : 'User is already represented by another agent' }, { status: 409 })
      }
    }

    // User exists and has no agent -> Bind them
    if (process.env.NEXT_PUBLIC_APP_REGION !== 'china') {
       // Supabase (Global)
       // We need to use prisma directly to handle TenantProfile relation reliably
       const dbUser = await prisma.user.findUnique({ 
          where: { id: existingUser.id },
          include: { tenantProfile: true }
       })
       
       if (dbUser?.tenantProfile) {
          await prisma.tenantProfile.update({
             where: { id: dbUser.tenantProfile.id },
             data: { representedById: user.id }
          })
       } else {
          await prisma.tenantProfile.create({
             data: {
                userId: existingUser.id,
                representedById: user.id
             }
          })
       }
    } else {
       // CloudBase (China)
       // representedById is stored on the user document root
       await db.updateUser(existingUser.id, { representedById: user.id })
    }

    // Send notification to the tenant
    try {
      const notificationTitle = region === 'china' ? '新的中介代理' : 'New Agent Representation'
      const notificationMessage = region === 'china'
        ? `您已由${user.name || '中介'}代理，将协助您找房与洽谈。`
        : `You are now represented by ${user.name || 'an agent'}.`
      const welcomeMessage = region === 'china'
        ? `您好！我现在是您的专属中介，将协助您找房与洽谈。如有问题欢迎随时联系。`
        : `Hello! I am now your representing agent. I will help you find properties and negotiate leases. Feel free to message me here.`
      // 1. Create Notification
      await db.create('notifications', {
          userId: existingUser.id,
          type: 'SYSTEM',
          title: notificationTitle,
          message: notificationMessage,
          isRead: false
      })
      console.log(`[Invite] Notification created for user ${existingUser.id}`)

      // 2. Create Message (More visible in Message Center)
      await db.create('messages', {
          senderId: user.id,
          receiverId: existingUser.id,
          content: welcomeMessage,
          isRead: false,
          propertyId: null // General message
      })
      console.log(`[Invite] Welcome message created for user ${existingUser.id}`)

    } catch (e: any) {
      console.error('Failed to create notification/message:', e)
      // Ignore notification error, binding was successful
    }

    return NextResponse.json({ message: region === 'china' ? '绑定成功' : 'User bound successfully', status: 'bound' })

  } catch (error: any) {
    console.error('Invite error:', error)
    return NextResponse.json({ error: error.message || 'Failed to invite user' }, { status: 500 })
  }
}

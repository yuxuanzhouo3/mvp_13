import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    const region = process.env.NEXT_PUBLIC_APP_REGION || 'global'
    if (!user || user.userType !== 'AGENT') {
      return NextResponse.json({ error: region === 'china' ? '无权限' : 'Unauthorized' }, { status: 401 })
    }

    const { email, userType } = await request.json()
    const targetType = (userType || 'TENANT').toString().toUpperCase()
    if (!email) {
      return NextResponse.json({ error: region === 'china' ? '请输入邮箱' : 'Email is required' }, { status: 400 })
    }

    const db = getDatabaseAdapter()
    let agentId = user.id
    if (user.email) {
      try {
        const dbUser = await db.findUserByEmail(user.email)
        if (dbUser?.id) agentId = dbUser.id
      } catch (e) {
        agentId = user.id
      }
    }
    const agentIdSet = new Set([String(user.id), String(agentId)])
    
    // Check if user exists
    // Note: findUserByEmail returns UnifiedUser. For checking existence it is fine.
    const existingUser = await db.findUserByEmail(email)

    // Generate signature for invite link
    const crypto = require('crypto')
    const secret = process.env.NEXTAUTH_SECRET || 'secret'
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${agentId}:${email}:${targetType.toLowerCase()}`)
      .digest('hex')

    if (!existingUser) {
      // User does not exist - Create a placeholder user so they appear in the agent's list
      // This allows the agent to see "Pending" users
      try {
        console.log(`[Invite] Creating placeholder user for ${email}`)
        const newUser = await db.createUser({
          email,
          password: `INVITE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Placeholder password
          name: email.split('@')[0], // Default name from email
          userType: targetType,
          representedById: agentId
        })
        
        console.log(`[Invite] Placeholder user created: ${newUser.id}`)

        // Send Invitation Email (Mocked)
        // We still send the link for them to "Claim" the account (Signup)
        const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/signup?ref=${agentId}&email=${encodeURIComponent(email)}&userType=${targetType.toLowerCase()}&sig=${signature}`
        
        console.log(`[Invite] Sending invitation to ${email} from agent ${agentId}. Link: ${inviteLink}`)
        
        return NextResponse.json({ 
          message: region === 'china' ? '邀请已发送' : 'Invitation sent successfully', 
          status: 'invited_and_created',
          inviteLink 
        })
      } catch (createError) {
        console.error('[Invite] Failed to create placeholder user:', createError)
        // Fallback to just sending email if creation fails (shouldn't happen)
        const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/signup?ref=${agentId}&email=${encodeURIComponent(email)}&userType=${targetType.toLowerCase()}&sig=${signature}`
        return NextResponse.json({ 
          message: region === 'china' ? '邀请已发送' : 'Invitation sent successfully', 
          status: 'invited',
          inviteLink 
        })
      }
    }

    // User exists
    if (existingUser.userType !== targetType) {
      const errorMessage = targetType === 'LANDLORD'
        ? (region === 'china' ? '该用户不是房东' : 'User exists but is not a landlord')
        : (region === 'china' ? '该用户不是租客' : 'User exists but is not a tenant')
      return NextResponse.json({ error: errorMessage }, { status: 400 })
    }

    // Check if already has agent
    // existingUser.representedById is populated now in db-adapter
    if (existingUser.representedById) {
      if (agentIdSet.has(String(existingUser.representedById))) {
        const message = targetType === 'LANDLORD'
          ? (region === 'china' ? '该房东已是您的合作对象' : 'Landlord is already connected to you')
          : (region === 'china' ? '该用户已是您的客户' : 'User is already your client')
        return NextResponse.json({ message, status: 'already_bound' })
      } else {
        const errorMessage = targetType === 'LANDLORD'
          ? (region === 'china' ? '该房东已绑定其他中介' : 'Landlord is already connected to another agent')
          : (region === 'china' ? '该用户已绑定其他中介' : 'User is already represented by another agent')
        return NextResponse.json({ error: errorMessage }, { status: 409 })
      }
    }

    // User exists and has no agent -> Bind them
    await db.updateUser(existingUser.id, { representedById: agentId })

    // Send notification to the tenant/landlord
    try {
      const notificationTitle = targetType === 'LANDLORD'
        ? (region === 'china' ? '新的中介合作' : 'New Agent Partnership')
        : (region === 'china' ? '新的中介代理' : 'New Agent Representation')
      const notificationMessage = targetType === 'LANDLORD'
        ? (region === 'china'
          ? `您已与${user.name || '中介'}建立合作关系，将协助您管理房源与租赁。`
          : `You are now partnered with ${user.name || 'an agent'} to manage your listings and leases.`)
        : (region === 'china'
          ? `您已由${user.name || '中介'}代理，将协助您找房与洽谈。`
          : `You are now represented by ${user.name || 'an agent'}.`)
      const welcomeMessage = targetType === 'LANDLORD'
        ? (region === 'china'
          ? `您好！我将协助您管理房源与租赁流程，有任何需求欢迎随时联系。`
          : `Hello! I will help you manage listings and rentals. Feel free to message me anytime.`)
        : (region === 'china'
          ? `您好！我现在是您的专属中介，将协助您找房与洽谈。如有问题欢迎随时联系。`
          : `Hello! I am now your representing agent. I will help you find properties and negotiate leases. Feel free to message me here.`)
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
          senderId: agentId,
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

    const successMessage = targetType === 'LANDLORD'
      ? (region === 'china' ? '房东绑定成功' : 'Landlord bound successfully')
      : (region === 'china' ? '绑定成功' : 'User bound successfully')
    return NextResponse.json({ message: successMessage, status: 'bound' })

  } catch (error: any) {
    console.error('Invite error:', error)
    return NextResponse.json({ error: error.message || 'Failed to invite user' }, { status: 500 })
  }
}

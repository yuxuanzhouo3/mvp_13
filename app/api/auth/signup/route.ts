import { NextRequest, NextResponse } from 'next/server'
import { signUp } from '@/lib/auth-adapter'
import { trackEvent } from '@/lib/analytics'
import { getDatabaseAdapter } from '@/lib/db-adapter'
import { validateEmail } from '@/lib/validation'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, name, phone, userType, agentId, ref, sig } = body
    // 优先使用 agentId，其次使用 ref 参数
    let representedById = agentId || ref

    // Verify signature if representedById is present to prevent unauthorized binding
    if (representedById) {
      try {
        const crypto = require('crypto')
        const secret = process.env.NEXTAUTH_SECRET || 'secret'
        // userType defaults to TENANT if not provided, consistent with invite logic
        const typeToVerify = (userType || 'TENANT').toString().toLowerCase()
        
        const expectedSig = crypto
          .createHmac('sha256', secret)
          .update(`${representedById}:${email}:${typeToVerify}`)
          .digest('hex')
        
        if (sig !== expectedSig) {
          console.warn(`[Signup] Invalid signature for representedById: ${representedById}. Ignoring binding.`)
          representedById = null
        }
      } catch (e) {
        console.error('[Signup] Signature verification failed:', e)
        representedById = null
      }
    }

    const { getAppRegion } = await import('@/lib/db-adapter')
    const region = getAppRegion()
    const isChina = region === 'china'
    
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: isChina ? '缺少必填字段' : 'Missing required fields' },
        { status: 400 }
      )
    }

    // 验证邮箱格式
    if (!validateEmail(email)) {
      return NextResponse.json(
        { error: isChina ? '邮箱格式不正确' : 'Invalid email format' },
        { status: 400 }
      )
    }

    // 使用统一的注册接口（自动根据环境变量选择 Supabase 或 JWT）
    const result = await signUp(email, password, {
      name,
      phone,
      userType,
      representedById
    })

    // Create notification and message if representedById is present
    if (representedById) {
      try {
        const db = getDatabaseAdapter()
        // Fetch agent name for better message
        const agent = await db.findUserById(representedById)
        const agentName = agent?.name || 'an agent'
        
        // 1. Notification
        await db.create('notifications', {
          userId: result.user.id,
          type: 'SYSTEM',
          title: 'Welcome! You are represented',
          message: `Welcome to RentGuard! You are now represented by ${agentName}.`,
          isRead: false
        })

        // 2. Message
        await db.create('messages', {
          senderId: representedById,
          receiverId: result.user.id,
          content: `Welcome to RentGuard! I am ${agentName}, your representing agent. I will help you find properties and negotiate leases. Feel free to message me here.`,
          isRead: false,
          propertyId: null
        })
      } catch (e) {
        console.error('Failed to create welcome notification/message:', e)
      }
    }

    // 埋点：用户注册
    await trackEvent({
      type: 'USER_SIGNUP',
      userId: result.user.id,
      metadata: {
        userType,
        email,
      },
    })

    return NextResponse.json({
      user: result.user,
      token: result.token
    })
  } catch (error: any) {
    console.error('Signup error:', error)
    const { getAppRegion } = await import('@/lib/db-adapter')
    const region = getAppRegion()
    const isChina = region === 'china'
    
    // 提供更详细的错误信息
    const errorMessage = error.message || (isChina ? '注册失败' : 'Registration failed')
    const lower = errorMessage.toLowerCase()
    
    // 检查是否是数据库连接问题
    if (
      lower.includes("can't reach database server") ||
      lower.includes('can\\u2019t reach database server') ||
      lower.includes('maxclients') ||
      lower.includes('max clients reached') ||
      lower.includes('pool_size') ||
      lower.includes("can't reach") ||
      lower.includes('connection') ||
      lower.includes('timeout') ||
      lower.includes('pooler')
    ) {
      return NextResponse.json(
        { 
          error: isChina ? '数据库连接失败，请稍后重试' : 'Database connection failed, please try again later',
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        },
        { status: 503 }
      )
    }
    
    console.error('Signup error details:', {
      message: errorMessage,
      stack: error.stack,
      name: error.name,
    })
    
    // 如果错误信息已经包含了 "Registration failed" 或 "注册失败"，直接使用
    // 否则添加前缀
    let finalErrorMessage = errorMessage
    if (!lower.includes('registration failed') && !lower.includes('注册失败') && !lower.includes('signup failed')) {
      finalErrorMessage = isChina ? `注册失败：${errorMessage}` : `Registration failed: ${errorMessage}`
    }
    
    return NextResponse.json(
      { 
        error: finalErrorMessage,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 400 }
    )
  }
}

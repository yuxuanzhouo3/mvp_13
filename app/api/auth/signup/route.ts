import { NextRequest, NextResponse } from 'next/server'
import { signUp } from '@/lib/auth-adapter'
import { trackEvent } from '@/lib/analytics'
import { getDatabaseAdapter } from '@/lib/db-adapter'
import { validateEmail } from '@/lib/validation'

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7)
  console.log(`[${requestId}] Signup Request Started`)
  
  const run = async (): Promise<NextResponse> => {
    const body = await request.json()
    let { email, password, name, phone, userType, agentId, ref, sig } = body
    
    // 去除首尾空格，防止因空格导致邮箱格式校验失败
    if (email && typeof email === 'string') {
      email = email.trim()
    }
    
    console.log(`[${requestId}] Signup Params:`, { email, userType, ref, agentId, appRegion: process.env.NEXT_PUBLIC_APP_REGION })
    
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
    const start = Date.now()
    console.log(`[${requestId}] Calling signUp adapter...`)
    
    const result = await signUp(email, password, {
      name,
      phone,
      userType,
      representedById
    })
    
    console.log(`[${requestId}] SignUp Adapter Success in ${Date.now() - start}ms`)

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
        region,
        representedById
      }
    })

    return NextResponse.json({
      user: result.user,
      token: result.token
    })
  } // End of run()

  try {
    // 设置整体超时，稍微小于前端的 60s（这里设 55s），以便后端先报错而不是前端中断
    const res = await Promise.race([
      run(),
      new Promise<NextResponse>((_, reject) => {
        setTimeout(() => {
          reject(new Error(process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '注册超时，请稍后重试' : 'Signup timed out, please try again'))
        }, 55000)
      })
    ])
    return res
  } catch (error: any) {
    console.error(`[${requestId}] Signup Error:`, error)
    const isChina = process.env.NEXT_PUBLIC_APP_REGION === 'china'
    return NextResponse.json(
      { error: error.message || (isChina ? '注册失败' : 'Signup failed') },
      { status: 400 }
    )
  }
}

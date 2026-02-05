import { NextRequest, NextResponse } from 'next/server'
import { signUp } from '@/lib/auth-adapter'
import { trackEvent } from '@/lib/analytics'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, name, phone, userType } = body

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: '缺少必填字段' },
        { status: 400 }
      )
    }

    // 使用统一的注册接口（自动根据环境变量选择 Supabase 或 JWT）
    const result = await signUp(email, password, {
      name,
      phone,
      userType,
    })

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
    // 提供更详细的错误信息
    const errorMessage = error.message || '注册失败'
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
          error: '数据库连接失败，请稍后重试',
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
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 400 }
    )
  }
}

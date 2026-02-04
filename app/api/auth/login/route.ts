import { NextRequest, NextResponse } from 'next/server'
import { login } from '@/lib/auth-adapter'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: '邮箱和密码不能为空' },
        { status: 400 }
      )
    }

    // 使用统一的登录接口（自动根据环境变量选择 Supabase 或 JWT）
    const result = await login(email, password)

    return NextResponse.json({
      user: result.user,
      token: result.token
    })
  } catch (error: any) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: error.message || '登录失败', details: error.message },
      { status: 401 }
    )
  }
}

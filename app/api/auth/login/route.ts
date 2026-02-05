import { NextRequest, NextResponse } from 'next/server'
import { login, loginWithJWT, loginWithSupabase } from '@/lib/auth-adapter'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    // 根据环境变量自动判断区域（不再从前端传递）
    const { getAppRegion } = await import('@/lib/db-adapter')
    const appRegion = getAppRegion()

    if (!email || !password) {
      return NextResponse.json(
        { error: '邮箱和密码不能为空' },
        { status: 400 }
      )
    }

    let result
    // 根据选择的区域使用对应的登录方式
    if (appRegion === 'china') {
      // 国内版：直接使用 JWT 登录
      result = await loginWithJWT(email, password)
    } else {
      // 国际版：先尝试 Supabase，失败则直接降级到 JWT（避免数据库连接池问题）
      try {
        result = await loginWithSupabase(email, password)
      } catch (error: any) {
        // 如果 Supabase 登录失败（包括数据库连接问题），直接使用 JWT 登录
        // loginWithSupabase 内部已经处理了降级，但如果还是失败，这里再次尝试 JWT
        const errorMsg = String(error?.message || '')
        const lower = errorMsg.toLowerCase()
        console.warn('Supabase login failed, falling back to JWT:', errorMsg)
        try {
          result = await loginWithJWT(email, password)
        } catch (jwtError: any) {
          // 如果 JWT 也失败，抛出更友好的错误信息
          // 检查是否是数据库连接问题
          const jwtErrorMsg = String(jwtError?.message || '')
          const jwtLower = jwtErrorMsg.toLowerCase()
          if (
            jwtLower.includes("can't reach database server") ||
            jwtLower.includes('can\\u2019t reach database server') ||
            jwtLower.includes('maxclients') ||
            jwtLower.includes('max clients reached') ||
            jwtLower.includes('pool_size') ||
            jwtLower.includes("can't reach") ||
            jwtLower.includes('connection') ||
            jwtLower.includes('timeout') ||
            jwtLower.includes('pooler')
          ) {
            throw new Error('数据库连接失败，请稍后重试')
          }
          throw new Error('登录失败：邮箱或密码错误')
        }
      }
    }

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

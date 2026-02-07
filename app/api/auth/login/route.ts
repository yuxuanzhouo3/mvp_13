import { NextRequest, NextResponse } from 'next/server'
import { login, loginWithJWT, loginWithSupabase } from '@/lib/auth-adapter'

export async function POST(request: NextRequest) {
  let email = '' // 在外部作用域声明，以便在 catch 块中使用
  
  try {
    const body = await request.json()
    email = body.email
    const password = body.password

    // 根据环境变量自动判断区域（不再从前端传递）
    const { getAppRegion } = await import('@/lib/db-adapter')
    const appRegion = getAppRegion()

    const isChina = appRegion === 'china'
    
    if (!email || !password) {
      return NextResponse.json(
        { error: isChina ? '邮箱和密码不能为空' : 'Email and password are required' },
        { status: 400 }
      )
    }

    let result
    // 根据选择的区域使用对应的登录方式
    if (appRegion === 'china') {
      // 国内版：直接使用 JWT 登录
      console.log('[Login] 国内版模式，使用 JWT 登录')
      result = await loginWithJWT(email, password)
    } else {
      // 国际版：先尝试 Supabase，失败则直接降级到 JWT（避免数据库连接池问题）
      console.log('[Login] 国际版模式，尝试 Supabase 登录')
      
      // 检查 Supabase 配置
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
      
      if (!supabaseUrl || !supabaseKey) {
        console.warn('[Login] ⚠️ Supabase 环境变量未配置，降级到 JWT 登录')
        console.warn('[Login] 需要配置: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY')
        // 直接使用 JWT 登录
        try {
          result = await loginWithJWT(email, password)
        } catch (jwtError: any) {
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
            // 在开发环境下抛出详细错误
            // if (process.env.NODE_ENV === 'development') {
              const maskedUrl = (process.env.DATABASE_URL || '').replace(/:[^:]*@/, ':****@')
              throw new Error(`Database connection failed: ${jwtErrorMsg} (URL: ${maskedUrl})`)
            // }
            // throw new Error('Database connection failed, please try again later')
          }
          throw new Error('Invalid email or password')
        }
      } else {
        // Supabase 已配置，尝试登录
        try {
          result = await loginWithSupabase(email, password)
          console.log('[Login] ✅ Supabase 登录成功')
        } catch (error: any) {
          // 如果 Supabase 登录失败（包括数据库连接问题），直接使用 JWT 登录
          // loginWithSupabase 内部已经处理了降级，但如果还是失败，这里再次尝试 JWT
          const errorMsg = String(error?.message || '')
          const lower = errorMsg.toLowerCase()
          console.warn('[Login] Supabase 登录失败，降级到 JWT:', errorMsg)
          console.warn('[Login] 错误详情:', {
            message: errorMsg,
            email: email,
            hasSupabaseConfig: !!(supabaseUrl && supabaseKey)
          })
          
          try {
            result = await loginWithJWT(email, password)
            console.log('[Login] ✅ JWT 登录成功（降级）')
          } catch (jwtError: any) {
            // 如果 JWT 也失败，抛出更友好的错误信息
            // 检查是否是数据库连接问题
            const jwtErrorMsg = String(jwtError?.message || '')
            const jwtLower = jwtErrorMsg.toLowerCase()
            console.error('[Login] ❌ JWT 登录也失败:', jwtErrorMsg)
            
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
              // 在开发环境下抛出详细错误
              // if (process.env.NODE_ENV === 'development') {
                const maskedUrl = (process.env.DATABASE_URL || '').replace(/:[^:]*@/, ':****@')
                throw new Error(`Database connection failed: ${jwtErrorMsg} (URL: ${maskedUrl})`)
              // }
              // throw new Error('Database connection failed, please try again later')
            }
            throw new Error('Invalid email or password')
          }
        }
      }
    }

    return NextResponse.json({
      user: result.user,
      token: result.token
    })
  } catch (error: any) {
    console.error('[Login] ❌ 登录失败:', {
      error: error.message,
      stack: error.stack,
      email: email
    })
    
    const { getAppRegion } = await import('@/lib/db-adapter')
    const region = getAppRegion()
    const isChina = region === 'china'
    
    // 直接使用错误信息，不再添加前缀（错误信息应该已经包含完整信息）
    let errorMessage = error.message || (isChina ? '登录失败' : 'Login failed')
    
    // 确保错误消息不包含重复的前缀
    if (errorMessage.toLowerCase().startsWith('login failed')) {
      errorMessage = errorMessage.replace(/^login failed:?\s*/i, '')
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 401 }
    )
  }
}

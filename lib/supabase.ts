/**
 * Supabase Client Configuration
 * For direct database access and real-time features
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// 只有在国际版且配置了 Supabase 环境变量时才初始化
// 国内版不需要 Supabase，所以允许缺少这些环境变量
let supabase: ReturnType<typeof createClient> | null = null
let supabaseAdmin: ReturnType<typeof createClient> | null = null

if (supabaseUrl && supabaseAnonKey) {
  try {
    // Client-side Supabase client (uses anon key)
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
      },
      auth: {
        persistSession: false, // We're using JWT for auth
      },
    })

    // Server-side Supabase client (uses service role key for admin operations)
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey
    supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        global: {
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
        },
        auth: {
          persistSession: false,
        },
      }
    )
    console.log('Supabase clients initialized successfully:', {
      url: supabaseUrl,
      hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      serviceRoleKeyLength: serviceRoleKey.length
    })
  } catch (error) {
    console.error('Failed to initialize Supabase clients:', error)
  }
} else {
  const region = process.env.NEXT_PUBLIC_APP_REGION || 'global'
  if (region === 'global') {
    console.warn('⚠️ [Supabase] 国际版模式，但 Supabase 环境变量未配置！')
    console.warn('[Supabase] 需要配置以下环境变量:')
    console.warn('  - NEXT_PUBLIC_SUPABASE_URL: Supabase 项目 URL')
    console.warn('  - NEXT_PUBLIC_SUPABASE_ANON_KEY: Supabase Anon Key')
    console.warn('  - SUPABASE_SERVICE_ROLE_KEY: (推荐) Supabase Service Role Key')
    console.warn('[Supabase] 系统将降级使用 JWT 登录，但 Supabase Auth 功能将不可用')
    console.warn('[Supabase] 获取这些值: https://app.supabase.com -> 项目设置 -> API')
  } else {
    console.log('[Supabase] 国内版模式，不需要 Supabase')
  }
}

// 导出 Supabase 客户端，如果未初始化则返回 null
export { supabase, supabaseAdmin }

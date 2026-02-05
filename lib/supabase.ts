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
      auth: {
        persistSession: false, // We're using JWT for auth
      },
    })

    // Server-side Supabase client (uses service role key for admin operations)
    supabaseAdmin = createClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey,
      {
        auth: {
          persistSession: false,
        },
      }
    )
  } catch (error) {
    console.warn('Failed to initialize Supabase clients:', error)
  }
} else {
  console.warn('Supabase environment variables not configured. This is normal for China region.')
}

// 导出 Supabase 客户端，如果未初始化则返回 null
export { supabase, supabaseAdmin }

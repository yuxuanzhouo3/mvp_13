import { NextRequest, NextResponse } from 'next/server'
import { getAppRegion } from '@/lib/db-adapter'
import { supabaseAdmin } from '@/lib/supabase'
import { getDatabaseAdapter } from '@/lib/db-adapter'

/**
 * 调试端点：检查登录配置和用户状态
 * 用于诊断登录问题
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    
    const region = getAppRegion()
    const isChina = region === 'china'
    
    const result: any = {
      region,
      isChina,
      timestamp: new Date().toISOString(),
      environment: {
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasJwtSecret: !!process.env.JWT_SECRET,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? '已配置' : '未配置',
      },
      supabase: {
        initialized: !!supabaseAdmin,
        status: supabaseAdmin ? '已初始化' : '未初始化'
      }
    }
    
    // 如果提供了邮箱，检查用户状态
    if (email) {
      result.userCheck = {
        email,
        inSupabaseAuth: false,
        inDatabase: false,
        supabaseUser: null,
        databaseUser: null,
        errors: []
      }
      
      // 检查 Supabase Auth
      if (supabaseAdmin && !isChina) {
        try {
          // 注意：Supabase Admin API 没有直接通过邮箱查找用户的方法
          // 我们需要尝试登录来检查用户是否存在
          // 这里只检查配置，不实际尝试登录
          result.userCheck.supabaseAuthCheck = '需要实际登录尝试才能验证'
        } catch (error: any) {
          result.userCheck.errors.push(`Supabase Auth 检查失败: ${error.message}`)
        }
      } else {
        result.userCheck.supabaseAuthCheck = isChina ? '国内版不需要 Supabase Auth' : 'Supabase 未初始化'
      }
      
      // 检查数据库
      try {
        const db = getDatabaseAdapter()
        const dbUser = await db.findUserByEmail(email)
        result.userCheck.inDatabase = !!dbUser
        if (dbUser) {
          result.userCheck.databaseUser = {
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.name,
            userType: dbUser.userType,
            hasPassword: !!dbUser.password
          }
        }
      } catch (error: any) {
        result.userCheck.errors.push(`数据库检查失败: ${error.message}`)
      }
    }
    
    return NextResponse.json(result, { status: 200 })
  } catch (error: any) {
    return NextResponse.json(
      { 
        error: '调试检查失败',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

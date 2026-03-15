/**
 * OAuth 回调路由（仅国际版支持）
 * 处理 Supabase OAuth 登录回调
 */

import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { supabase } from '@/lib/supabase'
import { getDatabaseAdapter, getAppRegion } from '@/lib/db-adapter'
import { trackEvent } from '@/lib/analytics'

export async function GET(request: NextRequest) {
  try {
    // 仅国际版支持 OAuth
    if (getAppRegion() !== 'global') {
      return NextResponse.redirect(new URL('/auth/login?error=oauth_not_supported', request.url))
    }

    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(new URL(`/auth/login?error=${error}`, request.url))
    }

    if (!code) {
      return NextResponse.redirect(new URL('/auth/login?error=no_code', request.url))
    }

    if (!supabase) {
      return NextResponse.redirect(new URL('/auth/login?error=oauth_not_configured', request.url))
    }

    const authClient = supabase.auth as any
    const pkceVerifier = request.cookies.get('sb-pkce-verifier')?.value
    if (pkceVerifier && authClient?.storageKey) {
      await authClient.storage.setItem(`${authClient.storageKey}-code-verifier`, pkceVerifier)
    }

    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError || !data.user || !data.session) {
      console.error('OAuth exchange failed:', exchangeError)
      const failedRedirect = NextResponse.redirect(new URL('/auth/login?error=exchange_failed', request.url))
      failedRedirect.cookies.set('sb-pkce-verifier', '', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/api/auth/callback',
        maxAge: 0,
      })
      return failedRedirect
    }

    const supabaseUser = data.user
    const db = getDatabaseAdapter()

    // 检查用户是否已存在
    let dbUser = await db.findUserByEmail(supabaseUser.email!)

    if (!dbUser) {
      // 创建新用户
      dbUser = await db.createUser({
        email: supabaseUser.email!,
        password: '', // OAuth 用户不需要密码
        name: supabaseUser.user_metadata?.name || supabaseUser.email!.split('@')[0],
        phone: supabaseUser.user_metadata?.phone,
        userType: supabaseUser.user_metadata?.userType || 'TENANT',
      })

      // 埋点：用户注册（OAuth）
      await trackEvent({
        type: 'USER_SIGNUP',
        userId: dbUser.id,
        metadata: {
          method: 'oauth',
          provider: supabaseUser.app_metadata?.provider || 'unknown',
        },
      })
    }

    // 埋点：用户登录（OAuth）
    await trackEvent({
      type: 'USER_LOGIN',
      userId: dbUser.id,
      metadata: {
        method: 'oauth',
        provider: supabaseUser.app_metadata?.provider || 'unknown',
      },
    })

    const jwtToken = jwt.sign(
      {
        userId: dbUser.id,
        id: dbUser.id,
        email: dbUser.email,
        userType: (dbUser.userType || 'TENANT').toString().toUpperCase(),
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    )

    const redirectUrl = new URL('/auth/login', request.url)
    redirectUrl.searchParams.set('token', jwtToken)

    const successRedirect = NextResponse.redirect(redirectUrl)
    successRedirect.cookies.set('sb-pkce-verifier', '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/auth/callback',
      maxAge: 0,
    })
    return successRedirect
  } catch (error: any) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(new URL('/auth/login?error=callback_failed', request.url))
  }
}

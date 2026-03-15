import { NextRequest, NextResponse } from 'next/server'
import { loginWithOAuth } from '@/lib/auth-adapter'
import { getAppRegion } from '@/lib/db-adapter'
import { supabase } from '@/lib/supabase'

/**
 * OAuth 登录（仅国际版支持）
 * GET /api/auth/oauth?provider=google
 */
export async function GET(request: NextRequest) {
  try {
    // 仅国际版支持 OAuth
    if (getAppRegion() !== 'global') {
      return NextResponse.json(
        { error: 'OAuth is only supported in global version' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const provider = searchParams.get('provider') as 'google' | 'github'

    if (!provider || !['google', 'github'].includes(provider)) {
      return NextResponse.json(
        { error: 'Invalid provider. Supported: google, github' },
        { status: 400 }
      )
    }

    // 获取 OAuth 登录 URL
    const result = await loginWithOAuth(provider, new URL(request.url).origin)

    const response = NextResponse.json({ url: result.url })
    const authClient = supabase?.auth as any
    const storageKey = authClient?.storageKey ? `${authClient.storageKey}-code-verifier` : null
    const codeVerifier = storageKey ? await authClient.storage.getItem(storageKey) : null

    if (codeVerifier) {
      response.cookies.set('sb-pkce-verifier', codeVerifier, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/api/auth/callback',
        maxAge: 60 * 10,
      })
    }

    return response
  } catch (error: any) {
    console.error('OAuth login error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate OAuth login', details: error.message },
      { status: 500 }
    )
  }
}

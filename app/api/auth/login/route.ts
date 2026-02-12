import { NextRequest, NextResponse } from 'next/server'
import { loginWithJWT } from '@/lib/auth-adapter'
import { prisma } from '@/lib/db'

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    })
  ])
}

const TOTAL_LOGIN_MS = 62000   // 整次登录硬性上限 62s，给海外 DB 留足时间
const JWT_TIMEOUT_MS_CHINA = 15000
const JWT_TIMEOUT_MS_GLOBAL = 55000  // 国际版只走 JWT，55s 覆盖 Prisma 3 次重试

export async function POST(request: NextRequest) {
  const run = async (): Promise<NextResponse> => {
    const body = await request.json()
    const { email, password, region, useJwtOnly } = body

    const appRegion = region || request.headers.get('X-App-Region') || process.env.NEXT_PUBLIC_APP_REGION || 'global'
    const isChina = appRegion === 'china'
    const timeoutMessage = isChina ? '登录超时，请稍后重试' : 'Login timed out, please try again'
    const missingMessage = isChina ? '邮箱和密码不能为空' : 'Email and password are required'

    if (!email || !password) {
      return NextResponse.json(
        { error: missingMessage },
        { status: 400 }
      )
    }

    // 国际版：先预热 DB 连接，减少后续 findUserByEmail 的等待
    if (!isChina) {
      try {
        await Promise.race([
          prisma.$connect(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('connect_timeout')), 8000))
        ])
      } catch (_) {
        // 忽略预热失败，继续走登录
      }
    }

    const jwtTimeoutMs = isChina ? JWT_TIMEOUT_MS_CHINA : JWT_TIMEOUT_MS_GLOBAL
    const result = await withTimeout(
      loginWithJWT(email, password),
      jwtTimeoutMs,
      timeoutMessage
    )

    return NextResponse.json({
      user: result.user,
      token: result.token
    })
  }

  try {
    const res = await Promise.race([
      run(),
      new Promise<NextResponse>((_, reject) => {
        setTimeout(() => {
          reject(new Error(process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '登录超时，请稍后重试' : 'Login timed out, please try again'))
        }, TOTAL_LOGIN_MS)
      })
    ])
    return res
  } catch (error: any) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: error.message || '登录失败', details: error.message },
      { status: 401 }
    )
  }
}

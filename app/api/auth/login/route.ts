import { NextRequest, NextResponse } from 'next/server'
import { loginWithJWT, loginWithSupabase } from '@/lib/auth-adapter'
import { prisma } from '@/lib/db'

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    })
  ])
}

const TOTAL_LOGIN_MS = 40000
const JWT_TIMEOUT_MS_CHINA = 25000
const JWT_TIMEOUT_MS_GLOBAL = 35000

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7)
  console.log(`[${requestId}] Login Request Started`)
  
  const run = async (): Promise<NextResponse> => {
    const body = await request.json()
    const { email, password, region, useJwtOnly } = body
    console.log(`[${requestId}] Login Params:`, { email, region, useJwtOnly, appRegion: process.env.NEXT_PUBLIC_APP_REGION })

    const appRegion = region || request.headers.get('X-App-Region') || process.env.NEXT_PUBLIC_APP_REGION || 'global'
    const isChina = appRegion === 'china'
    console.log(`[${requestId}] Determined Region: ${isChina ? 'China' : 'Global'}`)
    
    const timeoutMessage = isChina ? '登录超时，请稍后重试' : 'Login timed out, please try again'
    const missingMessage = isChina ? '邮箱和密码不能为空' : 'Email and password are required'

    if (!email || !password) {
      return NextResponse.json(
        { error: missingMessage },
        { status: 400 }
      )
    }

    const jwtTimeoutMs = isChina ? JWT_TIMEOUT_MS_CHINA : JWT_TIMEOUT_MS_GLOBAL
    const jwtFallbackTimeoutMs = 15000
    console.log(`[${requestId}] Timeout Limit: ${jwtTimeoutMs}ms`)
    
    const start = Date.now()
    try {
      // Determine which login method to use
      // If useJwtOnly is explicitly requested (e.g. frontend retry), force JWT login
      const shouldUseJwt = isChina || useJwtOnly
      
      let result
      if (shouldUseJwt) {
        result = await withTimeout(
          loginWithJWT(email, password),
          jwtTimeoutMs,
          timeoutMessage
        )
      } else {
        result = await withTimeout(
          loginWithSupabase(email, password),
          25000,
          timeoutMessage
        )
      }
      console.log(`[${requestId}] Login Success in ${Date.now() - start}ms`)
      
      return NextResponse.json({
        user: result.user,
        token: result.token
      })
    } catch (err: any) {
      console.error(`[${requestId}] Login Failed in ${Date.now() - start}ms:`, err)
      throw err
    }
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

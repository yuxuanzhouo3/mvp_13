import { NextRequest, NextResponse } from 'next/server'
import { loginWithJWT, loginWithSupabase } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'
import { validateEmail } from '@/lib/validation'
import jwt from 'jsonwebtoken'
import cloudbase from '@cloudbase/node-sdk'

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
const CLOUDBASE_ENV_ID =
  process.env.CLOUDBASE_ENV_ID ||
  process.env.NEXT_PUBLIC_CLOUDBASE_ENV_ID ||
  'homes-8ghqrqte660fbf1d'

const cloudbaseApp = cloudbase.init({
  env: CLOUDBASE_ENV_ID,
  secretId: process.env.CLOUDBASE_SECRET_ID || '',
  secretKey: process.env.CLOUDBASE_SECRET_KEY || '',
})

const getCloudbaseAccessToken = async () => {
  const authClient = (cloudbaseApp as any).auth()
  const credential = await authClient.getClientCredential()
  const accessToken =
    credential?.access_token ||
    credential?.token ||
    credential?.data?.access_token ||
    credential?.body?.access_token
  if (!accessToken) {
    throw new Error('CloudBase 鉴权失败')
  }
  return accessToken as string
}

const callCloudbaseAuthApi = async (path: string, payload: Record<string, any>) => {
  const accessToken = await getCloudbaseAccessToken()
  const response = await fetch(`https://${CLOUDBASE_ENV_ID}.api.tcloudbasegateway.com${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const text = await response.text()
  const data = text ? JSON.parse(text) : {}
  if (!response.ok) {
    throw new Error(data?.error_description || data?.error || data?.message || 'CloudBase 请求失败')
  }
  return data
}

const sendCloudbaseEmailCode = async (email: string) => {
  const result = await callCloudbaseAuthApi('/auth/v1/verification', {
    email,
    target: 'ANY',
  })
  const verificationId = result?.verification_id || result?.data?.verification_id
  if (!verificationId) {
    throw new Error('验证码发送失败，请稍后重试')
  }
  return verificationId as string
}

const verifyCloudbaseEmailCode = async (verificationId: string, verificationCode: string) => {
  const result = await callCloudbaseAuthApi('/auth/v1/verification/verify', {
    verification_id: verificationId,
    verification_code: verificationCode,
  })
  const verificationToken = result?.verification_token || result?.data?.verification_token
  if (!verificationToken) {
    throw new Error('验证码无效或已过期')
  }
  return verificationToken as string
}

const buildJwtLoginResultByEmail = async (email: string) => {
  const db = getDatabaseAdapter()
  const dbUser = await db.findUserByEmail(email)
  if (!dbUser) {
    throw new Error('该邮箱未注册，请先注册')
  }
  const token = jwt.sign(
    { userId: dbUser.id, email: dbUser.email },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '7d' }
  )
  return {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      userType: dbUser.userType,
      isPremium: dbUser.isPremium,
      vipLevel: dbUser.vipLevel || (dbUser.isPremium ? 'PREMIUM' : 'FREE'),
    },
    token,
  }
}

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7)
  console.log(`[${requestId}] Login Request Started`)
  
  const run = async (): Promise<NextResponse> => {
    const body = await request.json()
    const { email, password, region, useJwtOnly, action, verificationCode, verificationId, loginType } = body
    console.log(`[${requestId}] Login Params:`, { email, region, useJwtOnly, action, loginType, appRegion: process.env.NEXT_PUBLIC_APP_REGION })

    const appRegion = region || request.headers.get('X-App-Region') || process.env.NEXT_PUBLIC_APP_REGION || 'global'
    const isChina = appRegion === 'china'
    console.log(`[${requestId}] Determined Region: ${isChina ? 'China' : 'Global'}`)
    
    const timeoutMessage = isChina ? '登录超时，请稍后重试' : 'Login timed out, please try again'
    const missingMessage = isChina ? '邮箱和密码不能为空' : 'Email and password are required'

    const normalizedEmail = typeof email === 'string' ? email.trim() : ''

    if (action === 'sendEmailCode') {
      if (!normalizedEmail) {
        return NextResponse.json(
          { error: isChina ? '邮箱不能为空' : 'Email is required' },
          { status: 400 }
        )
      }
      if (!validateEmail(normalizedEmail)) {
        return NextResponse.json(
          { error: isChina ? '邮箱格式不正确' : 'Invalid email format' },
          { status: 400 }
        )
      }
      const verificationIdResult = await sendCloudbaseEmailCode(normalizedEmail)
      return NextResponse.json({
        verificationId: verificationIdResult,
      })
    }

    const shouldUseCodeLogin = loginType === 'code' || (verificationCode && verificationId)

    if (!normalizedEmail || (!password && !shouldUseCodeLogin)) {
      return NextResponse.json(
        { error: missingMessage },
        { status: 400 }
      )
    }

    if (shouldUseCodeLogin) {
      if (!verificationCode || !verificationId) {
        return NextResponse.json(
          { error: isChina ? '请输入验证码' : 'Verification code is required' },
          { status: 400 }
        )
      }
      await verifyCloudbaseEmailCode(String(verificationId), String(verificationCode))
      const result = await buildJwtLoginResultByEmail(normalizedEmail)
      return NextResponse.json({
        user: result.user,
        token: result.token,
      })
    }

    const jwtTimeoutMs = isChina ? JWT_TIMEOUT_MS_CHINA : JWT_TIMEOUT_MS_GLOBAL
    console.log(`[${requestId}] Timeout Limit: ${jwtTimeoutMs}ms`)
    
    const start = Date.now()
    try {
      // Determine which login method to use
      // If useJwtOnly is explicitly requested (e.g. frontend retry), force JWT login
      const shouldUseJwt = isChina || useJwtOnly
      
      let result
      if (shouldUseJwt) {
        result = await withTimeout(
          loginWithJWT(normalizedEmail, password),
          jwtTimeoutMs,
          timeoutMessage
        )
      } else {
        result = await withTimeout(
          loginWithSupabase(normalizedEmail, password),
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

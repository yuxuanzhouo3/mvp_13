import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { getDatabaseAdapter } from '@/lib/db-adapter'

export interface AuthUser {
  userId: string
  id: string
  email: string
  userType?: string
}

const authTimeoutMarker = Symbol('auth-timeout')
const withAuthTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T | typeof authTimeoutMarker> => {
  return await Promise.race([
    promise,
    new Promise<typeof authTimeoutMarker>((resolve) => {
      setTimeout(() => resolve(authTimeoutMarker), timeoutMs)
    })
  ])
}

/**
 * 从请求中获取认证用户
 */
export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.substring(7)
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key'
    ) as any

    return {
      ...decoded,
      userId: decoded.userId || decoded.id,
      id: decoded.id || decoded.userId
    }
  } catch (error) {
    try {
      const authHeader = request.headers.get('authorization')
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null
      }
      const token = authHeader.substring(7)
      const client = supabaseAdmin || supabase
      if (!client) {
        return null
      }
      const result = await withAuthTimeout(client.auth.getUser(token), 5000)
      if (result === authTimeoutMarker) {
        return null
      }
      const user = (result as any)?.data?.user
      if (!user) return null
      const userType = (user.user_metadata as any)?.userType
      let resolvedId = user.id
      try {
        const db = getDatabaseAdapter()
        let dbUser: any = null
        if (user.email) {
          const byEmail = await withAuthTimeout(db.findUserByEmail(String(user.email)), 2500)
          dbUser = byEmail === authTimeoutMarker ? null : byEmail
        }
        if (!dbUser) {
          const byId = await withAuthTimeout(db.findUserById(String(user.id)), 2500)
          dbUser = byId === authTimeoutMarker ? null : byId
        }
        if (dbUser?.id) {
          resolvedId = String(dbUser.id)
        }
      } catch {}
      return {
        userId: resolvedId,
        id: resolvedId,
        email: user.email || '',
        userType: userType
      }
    } catch (e) {
      return null
    }
  }
}

/**
 * 从Cookie中获取认证用户（用于服务端组件）
 */
export function getAuthUserFromCookie(cookieHeader: string | null): AuthUser | null {
  try {
    if (!cookieHeader) return null

    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=')
      acc[key] = value
      return acc
    }, {} as Record<string, string>)

    const token = cookies['auth-token']
    if (!token) return null

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key'
    ) as any

    return {
      ...decoded,
      userId: decoded.userId || decoded.id,
      id: decoded.id || decoded.userId
    }
  } catch (error) {
    return null
  }
}

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
      const timeoutPromise = new Promise<{ __timeout: true }>((resolve) =>
        setTimeout(() => resolve({ __timeout: true }), 5000)
      )
      const result = await Promise.race([client.auth.getUser(token), timeoutPromise])
      if ((result as any)?.__timeout) {
        return null
      }
      const user = (result as any)?.data?.user
      if (!user) return null
      const userType = (user.user_metadata as any)?.userType
      let resolvedUserId = user.id
      let resolvedEmail = user.email || ''
      try {
        const db = getDatabaseAdapter()
        const dbUser =
          (user.email ? await db.findUserByEmail(user.email) : null) ||
          (await db.findUserById(user.id))
        if (dbUser?.id) {
          resolvedUserId = dbUser.id
          resolvedEmail = dbUser.email || resolvedEmail
          return {
            userId: dbUser.id,
            id: dbUser.id,
            email: resolvedEmail,
            userType: dbUser.userType || userType
          }
        }
      } catch {}
      return {
        userId: resolvedUserId,
        id: resolvedUserId,
        email: resolvedEmail,
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

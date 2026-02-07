import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'

export interface AuthUser {
  userId: string
  id: string
  email: string
}

/**
 * 从请求中获取认证用户
 */
export function getAuthUser(request: NextRequest): AuthUser | null {
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
    return null
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

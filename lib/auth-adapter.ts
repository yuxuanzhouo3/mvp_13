/**
 * 身份验证适配器 - 统一 Supabase Auth 和自建 JWT 认证
 * 
 * 核心思路：
 * - 国际版：使用 Supabase Auth (OAuth + Email)
 * - 国内版：使用自建 JWT 认证
 * - 统一返回格式，供业务逻辑使用
 */

import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { supabase, supabaseAdmin } from './supabase'
import { createDatabaseAdapter, getDatabaseAdapter, getAppRegion } from './db-adapter'
import type { UnifiedUser } from './db-adapter'

// 统一的用户认证信息
export interface AuthUser {
  id: string
  email: string
  name?: string
  userType?: string
  isPremium?: boolean
  vipLevel?: string
}

// 认证结果
export interface AuthResult {
  user: AuthUser
  token: string
}

/**
 * 获取当前认证用户（统一接口）
 * 根据环境变量自动选择 Supabase Token 或 JWT Token 验证
 */
export async function getCurrentUser(request: NextRequest): Promise<AuthUser | null> {
  const region = getAppRegion()
  
  if (region === 'global') {
    // 国际版：允许 Supabase Token 或 JWT Token（用于 Supabase 限流时的降级登录/注册）
    const supabaseUser = await getCurrentUserFromSupabase(request)
    if (supabaseUser) return supabaseUser
    return await getCurrentUserFromJWT(request)
  } else {
    return await getCurrentUserFromJWT(request)
  }
}

/**
 * 国际版：从 Supabase Token 获取用户
 */
async function getCurrentUserFromSupabase(request: NextRequest): Promise<AuthUser | null> {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.substring(7)
    
    // 使用 Supabase Admin 验证 token
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    
    if (error || !user) {
      return null
    }

    // 从数据库获取用户详细信息
    const db = getDatabaseAdapter()
    // 注意：如果你数据库用户主键不是 supabase user.id，这里会找不到
    // 我们优先按 email 查找，避免两边 ID 不一致导致鉴权失败
    const dbUser =
      (user.email ? await db.findUserByEmail(user.email) : null) ||
      (await db.findUserById(user.id))
    
    if (!dbUser) {
      return null
    }

    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      userType: dbUser.userType,
      isPremium: dbUser.isPremium,
      vipLevel: dbUser.vipLevel || (dbUser.isPremium ? 'PREMIUM' : 'FREE'),
    }
  } catch (error) {
    console.error('Supabase auth error:', error)
    return null
  }
}

/**
 * 国内版：从 JWT Token 获取用户
 */
async function getCurrentUserFromJWT(request: NextRequest): Promise<AuthUser | null> {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.substring(7)
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key'
    ) as { userId: string; email: string }

    // 从数据库获取用户详细信息
    // 注意：JWT 分支只用于“国内版”或“国际版降级注册/登录且业务库可用”的情况。
    // 当 Prisma(Supabase Postgres) 不可达时，不应自动降级到 CloudBase（会导致跨区域数据混淆）。
    const db = getDatabaseAdapter()
    const dbUser = await db.findUserById(decoded.userId)
    
    if (!dbUser) {
      return null
    }

    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      userType: dbUser.userType,
      isPremium: dbUser.isPremium,
      vipLevel: dbUser.vipLevel || (dbUser.isPremium ? 'PREMIUM' : 'FREE'),
    }
  } catch (error) {
    console.error('JWT auth error:', error)
    return null
  }
}

/**
 * 国际版：使用 Supabase 注册
 */
export async function signUpWithSupabase(
  email: string,
  password: string,
  metadata?: { name?: string; phone?: string; userType?: string }
): Promise<AuthResult> {
  // 先尝试 Supabase 注册；若遇到限流则降级为“数据库 + JWT”
  const { data, error } = await supabaseAdmin.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: metadata?.name,
        phone: metadata?.phone,
        userType: metadata?.userType || 'TENANT',
      },
    },
  })

  if (error || !data.user) {
    const msg = error?.message || '注册失败'
    const lower = msg.toLowerCase()
    // Supabase 常见提示：email rate limit exceeded / rate limit
    if (lower.includes('rate limit')) {
      return await signUpWithJWT(email, password, metadata)
    }
    throw new Error(msg)
  }

  // 检查用户是否已在数据库中存在（可能通过 OAuth 创建）
  // ⚠️ 这里的业务库是 Prisma(Supabase Postgres)。如果你本地网络连不上 Supabase，会导致注册直接失败。
  // 解决：DB 不可达时，允许“仅 Supabase Auth 注册成功”，不阻塞用户注册。
  let dbUser: any = null
  const db = getDatabaseAdapter()
  try {
    dbUser = await db.findUserByEmail(email)
  } catch (e: any) {
    const msg = String(e?.message || '')
    if (msg.includes("Can't reach database server") || msg.includes('Can\\u2019t reach database server')) {
      // DB 不可达：直接返回 Auth-only 成功
      const token = data.session?.access_token || ''
      return {
        user: {
          id: data.user.id,
          email: data.user.email || email,
          name: metadata?.name || (data.user.user_metadata as any)?.name || email.split('@')[0],
          userType: metadata?.userType || (data.user.user_metadata as any)?.userType || 'TENANT',
          isPremium: false,
          vipLevel: 'FREE',
        },
        token,
      }
    }
    throw e
  }

  if (!dbUser) {
    // 在数据库中创建用户记录
    // 使用 Supabase 的 user.id 作为数据库用户 ID，保持一致性
    try {
      dbUser = await db.createUser({
        email,
        password: '', // Supabase 管理密码，我们不需要存储
        name: metadata?.name || data.user.user_metadata?.name || email.split('@')[0],
        phone: metadata?.phone || data.user.user_metadata?.phone,
        userType: metadata?.userType || data.user.user_metadata?.userType || 'TENANT',
      })
    } catch (createError: any) {
      const msg = String(createError?.message || '')
      if (msg.includes("Can't reach database server") || msg.includes('Can\\u2019t reach database server')) {
        // DB 不可达：直接返回 Auth-only 成功
        const token = data.session?.access_token || ''
        return {
          user: {
            id: data.user.id,
            email: data.user.email || email,
            name: metadata?.name || (data.user.user_metadata as any)?.name || email.split('@')[0],
            userType: metadata?.userType || (data.user.user_metadata as any)?.userType || 'TENANT',
            isPremium: false,
            vipLevel: 'FREE',
          },
          token,
        }
      }
      // 如果创建失败（可能是并发创建），尝试再次查找
      try {
        dbUser = await db.findUserByEmail(email)
      } catch {
        dbUser = null
      }
      if (!dbUser) throw new Error('创建用户失败: ' + msg)
    }
  }

  // 如果 Supabase 返回了 session，直接使用
  // 如果没有 session（需要邮箱验证），返回空 token，前端需要处理
  const token = data.session?.access_token || ''

  return {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      userType: dbUser.userType,
      isPremium: dbUser.isPremium,
      vipLevel: dbUser.vipLevel || 'FREE',
    },
    token,
  }
}

/**
 * 国际版：使用 Supabase 登录
 */
export async function loginWithSupabase(
  email: string,
  password: string
): Promise<AuthResult> {
  // 先尝试 Supabase 登录；若失败（比如用户是降级注册的，仅在本地数据库存在）则改用 JWT 登录
  const { data, error } = await supabaseAdmin.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.user || !data.session) {
    // 降级：尝试用本地数据库密码登录
    return await loginWithJWT(email, password)
  }

  // 从数据库获取用户详细信息
  let dbUser: any = null
  const db = getDatabaseAdapter()
  try {
    dbUser = await db.findUserByEmail(email)
  } catch (e: any) {
    const msg = String(e?.message || '')
    if (msg.includes("Can't reach database server") || msg.includes('Can\\u2019t reach database server')) {
      // DB 不可达：允许仅 Auth 登录成功
      return {
        user: {
          id: data.user.id,
          email: data.user.email || email,
          name: (data.user.user_metadata as any)?.name || email.split('@')[0],
          userType: (data.user.user_metadata as any)?.userType || 'TENANT',
          isPremium: false,
          vipLevel: 'FREE',
        },
        token: data.session.access_token,
      }
    }
    throw e
  }

  if (!dbUser) {
    // 兜底：Supabase 有该用户但数据库没有记录，则补一份
    dbUser = await db.createUser({
      email,
      password: '', // 由 Supabase 托管
      name: (data.user.user_metadata as any)?.name || email.split('@')[0],
      phone: (data.user.user_metadata as any)?.phone,
      userType: (data.user.user_metadata as any)?.userType || 'TENANT',
    })
  }

  return {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      userType: dbUser.userType,
      isPremium: dbUser.isPremium,
      vipLevel: dbUser.vipLevel || (dbUser.isPremium ? 'PREMIUM' : 'FREE'),
    },
    token: data.session.access_token,
  }
}

/**
 * 国内版：使用自建 JWT 注册
 */
export async function signUpWithJWT(
  email: string,
  password: string,
  metadata?: { name?: string; phone?: string; userType?: string }
): Promise<AuthResult> {
  const db = getDatabaseAdapter()
  
  // 检查用户是否已存在
  const existingUser = await db.findUserByEmail(email)
  if (existingUser) {
    throw new Error('该邮箱已被注册')
  }

  // 加密密码
  const hashedPassword = await bcrypt.hash(password, 10)

  // 创建用户
  const dbUser = await db.createUser({
    email,
    password: hashedPassword,
    name: metadata?.name || email.split('@')[0],
    phone: metadata?.phone,
    userType: metadata?.userType || 'TENANT',
  })

  // 生成 JWT token
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
      vipLevel: dbUser.vipLevel || 'FREE',
    },
    token,
  }
}

/**
 * 国内版：使用自建 JWT 登录
 */
export async function loginWithJWT(
  email: string,
  password: string
): Promise<AuthResult> {
  const db = getDatabaseAdapter()
  
  // 查找用户
  const dbUser = await db.findUserByEmail(email)
  if (!dbUser || !dbUser.password) {
    throw new Error('邮箱或密码错误')
  }

  // 验证密码
  const isValidPassword = await bcrypt.compare(password, dbUser.password)
  if (!isValidPassword) {
    throw new Error('邮箱或密码错误')
  }

  // 生成 JWT token
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

/**
 * 统一的注册接口
 */
export async function signUp(
  email: string,
  password: string,
  metadata?: { name?: string; phone?: string; userType?: string }
): Promise<AuthResult> {
  const region = getAppRegion()
  
  // 如果 Supabase 有速率限制，国内版直接使用 JWT，国际版也优先尝试 JWT
  // 这样可以避免 Supabase 的速率限制问题
  if (region === 'china') {
    return await signUpWithJWT(email, password, metadata)
  } else {
    // 国际版：先尝试 Supabase，如果失败（如速率限制），降级到 JWT
    try {
      return await signUpWithSupabase(email, password, metadata)
    } catch (error: any) {
      // 如果是速率限制错误，降级到 JWT 注册
      if (error.message?.includes('rate limit') || error.message?.includes('too many')) {
        console.warn('Supabase rate limit exceeded, falling back to JWT registration')
        return await signUpWithJWT(email, password, metadata)
      }
      // 其他错误直接抛出
      throw error
    }
  }
}

/**
 * 统一的登录接口
 */
export async function login(
  email: string,
  password: string
): Promise<AuthResult> {
  const region = getAppRegion()
  
  if (region === 'global') {
    try {
      return await loginWithSupabase(email, password)
    } catch (error: any) {
      // 如果 Supabase 登录失败，尝试从数据库查找用户
      // 可能是用户通过 JWT 注册的，但 Supabase 中没有
      const db = getDatabaseAdapter()
      const dbUser = await db.findUserByEmail(email)
      
      if (dbUser && dbUser.password) {
        // 用户存在于数据库，使用 JWT 登录
        return await loginWithJWT(email, password)
      }
      // 否则抛出原始错误
      throw error
    }
  } else {
    return await loginWithJWT(email, password)
  }
}

/**
 * OAuth 登录（仅国际版支持）
 */
export async function loginWithOAuth(provider: 'google' | 'github'): Promise<{ url: string }> {
  const region = getAppRegion()
  
  if (region !== 'global') {
    throw new Error('OAuth 登录仅在国际版支持')
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
    },
  })

  if (error || !data.url) {
    throw new Error(error?.message || 'OAuth 登录失败')
  }

  return { url: data.url }
}

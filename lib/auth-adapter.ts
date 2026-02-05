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
 * 优先尝试 JWT（因为更通用），然后尝试 Supabase（仅国际版）
 */
export async function getCurrentUser(request: NextRequest): Promise<AuthUser | null> {
  const region = getAppRegion()
  
  // 先尝试 JWT（无论区域，因为可能用户使用 JWT token）
  const jwtUser = await getCurrentUserFromJWT(request)
  if (jwtUser) return jwtUser
  
  // 如果是国际版，再尝试 Supabase
  if (region === 'global') {
    const supabaseUser = await getCurrentUserFromSupabase(request)
    if (supabaseUser) return supabaseUser
  }
  
  return null
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
    let dbUser = null
    try {
      dbUser =
        (user.email ? await db.findUserByEmail(user.email) : null) ||
        (await db.findUserById(user.id))
    } catch (dbError: any) {
      // 如果数据库查询失败（连接池问题等），从 Supabase user metadata 中提取信息
      const errorMsg = String(dbError?.message || '')
      const lower = errorMsg.toLowerCase()
      if (
        lower.includes("can't reach database server") ||
        lower.includes('can\\u2019t reach database server') ||
        lower.includes('maxclients') ||
        lower.includes('max clients reached') ||
        lower.includes('pool_size') ||
        lower.includes("can't reach") ||
        lower.includes('connection') ||
        lower.includes('timeout') ||
        lower.includes('pooler')
      ) {
        console.warn('Database connection issue, using Supabase user metadata')
        // 从 Supabase user metadata 中提取用户信息
        const userMetadata = user.user_metadata || {}
        return {
          id: user.id,
          email: user.email || '',
          name: userMetadata.name || user.email?.split('@')[0] || '',
          userType: userMetadata.userType || 'TENANT',
          isPremium: false,
          vipLevel: 'FREE',
        }
      }
      // 其他数据库错误，也使用 Supabase metadata
      console.warn('Database query failed, using Supabase user metadata:', errorMsg)
      const userMetadata = user.user_metadata || {}
      return {
        id: user.id,
        email: user.email || '',
        name: userMetadata.name || user.email?.split('@')[0] || '',
        userType: userMetadata.userType || 'TENANT',
        isPremium: false,
        vipLevel: 'FREE',
      }
    }
    
    if (!dbUser) {
      // 如果数据库中没有找到用户，但 Supabase 认证成功，使用 Supabase metadata
      console.warn('User not found in database, but Supabase auth is valid. Using Supabase metadata.')
      const userMetadata = user.user_metadata || {}
      return {
        id: user.id,
        email: user.email || '',
        name: userMetadata.name || user.email?.split('@')[0] || '',
        userType: userMetadata.userType || 'TENANT',
        isPremium: false,
        vipLevel: 'FREE',
      }
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
    let decoded: { userId: string; email: string; userType?: string }
    
    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'your-secret-key'
      ) as { userId: string; email: string; userType?: string }
    } catch (jwtError) {
      // JWT 验证失败（token 无效、过期等）
      console.error('JWT verification failed:', jwtError)
      return null
    }

    const db = getDatabaseAdapter()
    let dbUser = null
    
    try {
      // 先尝试通过 userId 查找
      if (decoded.userId) {
        dbUser = await db.findUserById(decoded.userId)
      }
      // 如果找不到，尝试通过 email 查找
      if (!dbUser && decoded.email) {
        dbUser = await db.findUserByEmail(decoded.email)
      }
    } catch (dbError: any) {
      // 如果数据库查询失败（如连接池问题），从 JWT token 中提取用户信息
      const errorMsg = String(dbError?.message || '')
      const lower = errorMsg.toLowerCase()
      if (
        lower.includes("can't reach database server") ||
        lower.includes('can\\u2019t reach database server') ||
        lower.includes('maxclients') ||
        lower.includes('max clients reached') ||
        lower.includes('pool_size') ||
        lower.includes("can't reach") ||
        lower.includes('connection') ||
        lower.includes('timeout') ||
        lower.includes('pooler')
      ) {
        console.warn('Database connection issue, but JWT token is valid. Using token info only.')
        // 如果数据库不可用，但 JWT token 有效，返回基于 token 的用户信息
        // 这是关键修复：即使数据库不可用，也能从 token 中获取 userType
        return {
          id: decoded.userId,
          email: decoded.email,
          name: decoded.email.split('@')[0],
          userType: decoded.userType || 'TENANT', // 从 token 中获取用户类型（关键！）
          isPremium: false,
          vipLevel: 'FREE',
        }
      }
      // 其他数据库错误，也尝试从 token 中提取信息
      console.warn('Database query failed, using JWT token info:', errorMsg)
      return {
        id: decoded.userId,
        email: decoded.email,
        name: decoded.email.split('@')[0],
        userType: decoded.userType || 'TENANT',
        isPremium: false,
        vipLevel: 'FREE',
      }
    }
    
    if (!dbUser) {
      // 如果数据库中没有找到用户，但 JWT token 有效，使用 token 中的信息
      console.warn('User not found in database, but JWT token is valid. Using token info.')
      return {
        id: decoded.userId,
        email: decoded.email,
        name: decoded.email.split('@')[0],
        userType: decoded.userType || 'TENANT',
        isPremium: false,
        vipLevel: 'FREE',
      }
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
  // 先尝试 Supabase 注册；若遇到限流或数据库连接问题则降级为"数据库 + JWT"
  let data, error
  try {
    const result = await supabaseAdmin.auth.signUp({
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
    data = result.data
    error = result.error
  } catch (supabaseError: any) {
    // 如果 Supabase 调用本身失败（可能是网络问题），降级到 JWT
    const errorMsg = String(supabaseError?.message || '')
    const lower = errorMsg.toLowerCase()
    if (
      lower.includes("can't reach") ||
      lower.includes('database server') ||
      lower.includes('connection') ||
      lower.includes('timeout') ||
      lower.includes('pooler') ||
      lower.includes('pool_size') ||
      lower.includes('maxclients')
    ) {
      console.warn('Supabase connection failed, falling back to JWT registration')
      return await signUpWithJWT(email, password, metadata)
    }
    throw new Error('注册失败：' + errorMsg)
  }

  if (error || !data.user) {
    const msg = error?.message || '注册失败'
    const lower = msg.toLowerCase()
    // Supabase 常见提示：email rate limit exceeded / rate limit
    // 或者数据库连接问题
    if (
      lower.includes('rate limit') ||
      lower.includes("can't reach") ||
      lower.includes('database server') ||
      lower.includes('connection')
    ) {
      console.warn('Supabase registration issue, falling back to JWT:', msg)
      return await signUpWithJWT(email, password, metadata)
    }
    throw new Error(msg)
  }

  // 检查用户是否已在数据库中存在（可能通过 OAuth 创建）
  // ⚠️ 这里的业务库是 Prisma(Supabase Postgres)。如果你本地网络连不上 Supabase，会导致注册直接失败。
  // 解决：DB 不可达时，允许"仅 Supabase Auth 注册成功"，不阻塞用户注册。
  let dbUser: any = null
  const db = getDatabaseAdapter()
  try {
    dbUser = await db.findUserByEmail(email)
  } catch (e: any) {
    // 数据库查询失败，使用 Supabase 返回的信息（降级方案）
    const msg = String(e?.message || '')
    const lower = msg.toLowerCase()
    const isConnectionError = 
      lower.includes("can't reach database server") ||
      lower.includes('can\\u2019t reach database server') ||
      lower.includes('maxclients') ||
      lower.includes('max clients reached') ||
      lower.includes('pool_size') ||
      lower.includes("can't reach") ||
      lower.includes('connection') ||
      lower.includes('timeout') ||
      lower.includes('pooler') ||
      lower.includes('prisma') ||
      lower.includes('query')
    
    if (isConnectionError) {
      console.warn('Database connection failed during Supabase registration, using Supabase user info')
      // 数据库连接失败，生成 JWT token 以便后续使用
      const jwtToken = jwt.sign(
        { 
          userId: data.user.id, 
          email: data.user.email || email,
          userType: metadata?.userType || (data.user.user_metadata as any)?.userType || 'TENANT'
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      )
      return {
        user: {
          id: data.user.id,
          email: data.user.email || email,
          name: metadata?.name || (data.user.user_metadata as any)?.name || email.split('@')[0],
          userType: metadata?.userType || (data.user.user_metadata as any)?.userType || 'TENANT',
          isPremium: false,
          vipLevel: 'FREE',
        },
        token: jwtToken, // 使用 JWT token 而不是 Supabase token
      }
    }
    // 其他错误也降级到 JWT 注册
    console.warn('Database query failed during Supabase registration, falling back to JWT:', msg)
    return await signUpWithJWT(email, password, metadata)
  }

  if (!dbUser) {
    // 在数据库中创建用户记录
    // 使用 Supabase 的 user.id 作为数据库用户 ID，保持一致性
    try {
      // 只有当 phone 有值时才传递，避免设置为 null
      const phoneValue = metadata?.phone || data.user.user_metadata?.phone
      dbUser = await db.createUser({
        email,
        password: '', // Supabase 管理密码，我们不需要存储
        name: metadata?.name || data.user.user_metadata?.name || email.split('@')[0],
        ...(phoneValue && phoneValue.trim() !== '' ? { phone: phoneValue.trim() } : {}),
        userType: metadata?.userType || data.user.user_metadata?.userType || 'TENANT',
      })
    } catch (createError: any) {
      const msg = String(createError?.message || '')
      const lower = msg.toLowerCase()
      const isConnectionError = 
        lower.includes("can't reach database server") ||
        lower.includes('can\\u2019t reach database server') ||
        lower.includes('maxclients') ||
        lower.includes('max clients reached') ||
        lower.includes('pool_size') ||
        lower.includes("can't reach") ||
        lower.includes('connection') ||
        lower.includes('timeout') ||
        lower.includes('pooler') ||
        lower.includes('prisma') ||
        lower.includes('query')
      
      if (isConnectionError) {
        // 数据库连接失败，生成 JWT token
        console.warn('Database connection failed during user creation, using Supabase user info')
        const jwtToken = jwt.sign(
          { 
            userId: data.user.id, 
            email: data.user.email || email,
            userType: metadata?.userType || (data.user.user_metadata as any)?.userType || 'TENANT'
          },
          process.env.JWT_SECRET || 'your-secret-key',
          { expiresIn: '7d' }
        )
        return {
          user: {
            id: data.user.id,
            email: data.user.email || email,
            name: metadata?.name || (data.user.user_metadata as any)?.name || email.split('@')[0],
            userType: metadata?.userType || (data.user.user_metadata as any)?.userType || 'TENANT',
            isPremium: false,
            vipLevel: 'FREE',
          },
          token: jwtToken,
        }
      }
      // 如果创建失败（可能是并发创建），尝试再次查找
      try {
        dbUser = await db.findUserByEmail(email)
      } catch {
        dbUser = null
      }
      if (!dbUser) {
        // 如果还是找不到，降级到 JWT 注册
        console.warn('User creation failed, falling back to JWT registration:', msg)
        return await signUpWithJWT(email, password, metadata)
      }
    }
  }

  // 如果 Supabase 返回了 session，生成 JWT token（避免数据库连接问题）
  // 如果没有 session（需要邮箱验证），也生成 JWT token
  const jwtToken = jwt.sign(
    { 
      userId: dbUser.id, 
      email: dbUser.email,
      userType: dbUser.userType 
    },
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
    token: jwtToken, // 使用 JWT token 而不是 Supabase token
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
  let data, error
  try {
    const result = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    })
    data = result.data
    error = result.error
  } catch (supabaseError: any) {
    // 如果 Supabase 调用本身失败（可能是网络问题），降级到 JWT
    const errorMsg = String(supabaseError?.message || '')
    const lower = errorMsg.toLowerCase()
    if (
      lower.includes("can't reach") ||
      lower.includes('database server') ||
      lower.includes('connection') ||
      lower.includes('timeout') ||
      lower.includes('pooler')
    ) {
      console.warn('Supabase connection failed, falling back to JWT login')
      return await loginWithJWT(email, password)
    }
    // 其他错误也尝试 JWT 登录
    console.warn('Supabase login error, falling back to JWT:', errorMsg)
    try {
      return await loginWithJWT(email, password)
    } catch (jwtError: any) {
      throw new Error('登录失败：' + errorMsg)
    }
  }

  if (error || !data.user || !data.session) {
    // Supabase 登录失败，尝试用本地数据库密码登录（JWT）
    console.warn('Supabase login failed, falling back to JWT:', error?.message)
    try {
      return await loginWithJWT(email, password)
    } catch (jwtError: any) {
      // 如果 JWT 也失败，说明用户可能在 Supabase 中但密码不匹配，或者用户不存在
      // 抛出更明确的错误
      if (error?.message?.includes('Invalid login credentials') || error?.message?.includes('Email not confirmed')) {
        throw new Error('邮箱或密码错误')
      }
      throw new Error('登录失败：' + (error?.message || jwtError?.message || '未知错误'))
    }
  }

  // Supabase 登录成功，尝试从数据库获取用户详细信息
  // 如果数据库连接失败，直接使用 Supabase 返回的信息并生成 JWT token
  let dbUser: any = null
  const db = getDatabaseAdapter()
  
  try {
    dbUser = await db.findUserByEmail(email)
  } catch (e: any) {
    // 数据库查询失败，使用 Supabase 返回的信息（降级方案）
    const msg = String(e?.message || '')
    const lower = msg.toLowerCase()
    // 检查是否是数据库连接问题
    const isConnectionError = 
      lower.includes("can't reach database server") ||
      lower.includes('can\\u2019t reach database server') ||
      lower.includes('maxclients') ||
      lower.includes('max clients reached') ||
      lower.includes('pool_size') ||
      lower.includes("can't reach") ||
      lower.includes('connection') ||
      lower.includes('timeout') ||
      lower.includes('pooler') ||
      lower.includes('prisma') ||
      lower.includes('query')
    
    if (isConnectionError) {
      console.warn('Database connection failed, using Supabase user info with JWT token')
    } else {
      console.warn('Database query failed, using Supabase user info:', msg)
    }
    
    // 生成 JWT token，包含从 Supabase metadata 中获取的用户类型
    const userType = (data.user.user_metadata as any)?.userType || 'TENANT'
    const jwtToken = jwt.sign(
      { 
        userId: data.user.id, 
        email: data.user.email || email,
        userType: userType
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    )
    return {
      user: {
        id: data.user.id,
        email: data.user.email || email,
        name: (data.user.user_metadata as any)?.name || email.split('@')[0],
        userType: userType,
        isPremium: false,
        vipLevel: 'FREE',
      },
      token: jwtToken, // 使用 JWT token，避免后续数据库连接问题
    }
  }

  if (!dbUser) {
    // 兜底：Supabase 有该用户但数据库没有记录，则补一份
    // 只有当 phone 有值时才传递，避免设置为 null
    const phoneValue = (data.user.user_metadata as any)?.phone
    try {
      dbUser = await db.createUser({
        email,
        password: '', // 由 Supabase 托管
        name: (data.user.user_metadata as any)?.name || email.split('@')[0],
        ...(phoneValue && phoneValue.trim() !== '' ? { phone: phoneValue.trim() } : {}),
        userType: (data.user.user_metadata as any)?.userType || 'TENANT',
      })
    } catch (createError: any) {
      // 如果创建用户失败（数据库连接问题），使用 Supabase 信息并生成 JWT token
      const msg = String(createError?.message || '')
      const lower = msg.toLowerCase()
      const isConnectionError = 
        lower.includes("can't reach database server") ||
        lower.includes('can\\u2019t reach database server') ||
        lower.includes('maxclients') ||
        lower.includes('max clients reached') ||
        lower.includes('pool_size') ||
        lower.includes("can't reach") ||
        lower.includes('connection') ||
        lower.includes('timeout') ||
        lower.includes('pooler') ||
        lower.includes('prisma') ||
        lower.includes('query')
      
      if (isConnectionError) {
        console.warn('Database connection failed during user creation, using Supabase info')
      } else {
        console.warn('User creation failed, using Supabase info:', msg)
      }
      
      // 使用 Supabase 信息并生成 JWT token
      const userType = (data.user.user_metadata as any)?.userType || 'TENANT'
      const jwtToken = jwt.sign(
        { 
          userId: data.user.id, 
          email: data.user.email || email,
          userType: userType
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      )
      return {
        user: {
          id: data.user.id,
          email: data.user.email || email,
          name: (data.user.user_metadata as any)?.name || email.split('@')[0],
          userType: userType,
          isPremium: false,
          vipLevel: 'FREE',
        },
        token: jwtToken,
      }
    }
  }

  // 无论是否从数据库获取到用户，都生成 JWT token（避免后续数据库连接问题）
  const jwtToken = jwt.sign(
    { 
      userId: dbUser.id, 
      email: dbUser.email,
      userType: dbUser.userType 
    },
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
    token: jwtToken, // 统一使用 JWT token
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

  // 生成 JWT token（包含用户类型信息）
  const token = jwt.sign(
    { 
      userId: dbUser.id, 
      email: dbUser.email,
      userType: dbUser.userType 
    },
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

  // 生成 JWT token（包含用户类型信息，方便后续验证）
  const token = jwt.sign(
    { 
      userId: dbUser.id, 
      email: dbUser.email,
      userType: dbUser.userType 
    },
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
    // 国际版：先尝试 Supabase，如果失败（如速率限制、数据库连接问题），降级到 JWT
    try {
      return await signUpWithSupabase(email, password, metadata)
    } catch (error: any) {
      const errorMsg = String(error?.message || '')
      const lower = errorMsg.toLowerCase()
      // 如果是速率限制、数据库连接问题或其他可恢复的错误，降级到 JWT 注册
      if (
        lower.includes('rate limit') || 
        lower.includes('too many') ||
        lower.includes("can't reach") ||
        lower.includes('database server') ||
        lower.includes('connection') ||
        lower.includes('timeout') ||
        lower.includes('pool_size') ||
        lower.includes('maxclients')
      ) {
        console.warn('Supabase registration issue, falling back to JWT registration:', errorMsg)
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

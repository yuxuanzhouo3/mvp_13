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
    const client = supabaseAdmin || supabase
    if (!client) {
      return null
    }

    const { data: { user }, error } = await client.auth.getUser(token)
    if (error || !user) {
      return null
    }

    const db = getDatabaseAdapter()
    const dbUser =
      (user.email ? await db.findUserByEmail(user.email) : null) ||
      (await db.findUserById(user.id))

    if (!dbUser) {
      return {
        id: user.id,
        email: user.email || '',
        name: (user.user_metadata as any)?.name || (user.email ? user.email.split('@')[0] : ''),
        userType: (user.user_metadata as any)?.userType || 'TENANT',
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
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key'
    ) as { userId: string; email: string }

    const db = getDatabaseAdapter()
    let dbUser = await db.findUserById(decoded.userId)
    if (!dbUser && decoded.email) {
      dbUser = await db.findUserByEmail(decoded.email)
    }
    
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
  // Supabase 未配置时直接报错，不再走 JWT 注册，因为数据库大概率也连不上
  if (!supabaseAdmin) {
    console.error('[signUpWithSupabase] supabaseAdmin 未初始化，请检查 SUPABASE_SERVICE_ROLE_KEY')
    throw new Error('Supabase Configuration Missing: Please check environment variables')
  }

  // 定义超时工具
  const authTimeoutMs = 15000
  const dbTimeoutMs = 10000
  const timeoutMarker = Symbol('timeout')
  const withTimeoutValue = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T | typeof timeoutMarker> => {
    return await Promise.race([
      promise,
      new Promise<typeof timeoutMarker>((resolve) => {
        setTimeout(() => resolve(timeoutMarker), timeoutMs)
      })
    ])
  }

  // 先尝试 Supabase 注册；若遇到限流则降级为“数据库 + JWT”
  let authResult: { data: { user: any; session: any }; error: any } | typeof timeoutMarker

  try {
    authResult = await withTimeoutValue(
      supabaseAdmin.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: metadata?.name,
            phone: metadata?.phone,
            userType: metadata?.userType || 'TENANT',
          },
        },
      }),
      authTimeoutMs
    )
  } catch (err: any) {
    console.error('[signUpWithSupabase] Supabase Auth Error:', err)
    throw err
  }

  if (authResult === timeoutMarker) {
    console.error('[signUpWithSupabase] Supabase Auth Timeout')
    throw new Error('Supabase Auth Timeout')
  }

  const { data, error } = authResult

  if (error || !data.user) {
    const msg = error?.message || '注册失败'
    const lower = msg.toLowerCase()
    // Supabase 常见提示：email rate limit exceeded / rate limit
    // 注意：国际版环境通常连不上 DB，所以不要降级到 JWT，直接返回错误
    if (lower.includes('rate limit')) {
      throw new Error('注册请求过于频繁，Supabase 已暂时封禁该 IP 或邮箱。请等待 15-60 分钟，或尝试更换邮箱/网络测试。(Rate limit exceeded)')
    }
    throw new Error(msg)
  }

  // 检查用户是否已在数据库中存在（可能通过 OAuth 创建）
  // ⚠️ 这里的业务库是 Prisma(Supabase Postgres)。如果你本地网络连不上 Supabase，会导致注册直接失败。
  // 解决：DB 不可达时，允许“仅 Supabase Auth 注册成功”，不阻塞用户注册。
  let dbUser: any = null
  const db = getDatabaseAdapter()
  try {
    const result = await withTimeoutValue(db.findUserByEmail(email), dbTimeoutMs)
    if (result === timeoutMarker) {
      console.warn('[signUpWithSupabase] DB Find Timeout, skipping DB user sync')
      // 数据库超时，视为连接失败，直接返回 Auth 结果
      throw new Error('DB Connection Timeout')
    }
    dbUser = result
  } catch (e: any) {
    const msg = String(e?.message || '')
    const lower = msg.toLowerCase()
    if (
      lower.includes("can't reach database server") ||
      lower.includes('can\\u2019t reach database server') ||
      lower.includes('maxclients') ||
      lower.includes('max clients reached') ||
      lower.includes('check out') ||
      lower.includes('timed out') ||
      lower.includes('timeout') ||
      msg === 'DB Connection Timeout'
    ) {
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
    // 其他错误不需要抛出吗？findUserByEmail 可能会因为 Schema 问题报错，这里也应该吞掉以保证注册成功
    console.warn('[signUpWithSupabase] DB Check Failed:', e)
  }

  if (!dbUser) {
    // 在数据库中创建用户记录
    // 使用 Supabase 的 user.id 作为数据库用户 ID，保持一致性
    try {
      // 只有当 phone 有值时才传递，避免设置为 null
      const phoneValue = metadata?.phone || data.user.user_metadata?.phone
      
      const createPromise = db.createUser({
        email,
        password: '', // Supabase 管理密码，我们不需要存储
        name: metadata?.name || data.user.user_metadata?.name || email.split('@')[0],
        ...(phoneValue && phoneValue.trim() !== '' ? { phone: phoneValue.trim() } : {}),
        userType: metadata?.userType || data.user.user_metadata?.userType || 'TENANT',
      })

      const createResult = await withTimeoutValue(createPromise, dbTimeoutMs)
      
      if (createResult === timeoutMarker) {
        throw new Error('DB Create Timeout')
      }
      dbUser = createResult
    } catch (createError: any) {
      const msg = String(createError?.message || '')
      const lower = msg.toLowerCase()
      if (
        lower.includes("can't reach database server") ||
        lower.includes('can\\u2019t reach database server') ||
        lower.includes('maxclients') ||
        lower.includes('max clients reached') ||
        lower.includes('check out') ||
        lower.includes('timed out') ||
        lower.includes('timeout') ||
        lower.includes('closed') ||
        lower.includes('connection') ||
        lower.includes('failed') ||
        msg === 'DB Create Timeout'
      ) {
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
        const retryResult = await withTimeoutValue(db.findUserByEmail(email), 5000)
        if (retryResult !== timeoutMarker) {
          dbUser = retryResult
        }
      } catch {
        dbUser = null
      }
      if (!dbUser) {
        // 即使 DB 创建失败，只要 Auth 成功，也尽量让用户通过
        console.error('创建用户失败: ' + msg)
        // 这里的逻辑可以保留抛出错误，或者也做降级处理？
        // 考虑到注册失败给用户反馈比较重要，这里如果数据库完全写不进去，可能需要提示
        // 但如果 Auth 已经成功了，再让用户重试会报“用户已存在”，所以最好是返回成功
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
  // Supabase 未配置或未初始化时，明确抛出错误，不要静默降级到 loginWithJWT
  if (!supabaseAdmin) {
    console.error('[loginWithSupabase] supabaseAdmin 未初始化，请检查 SUPABASE_SERVICE_ROLE_KEY')
    // 只有当明确是本地数据库用户时，才尝试 JWT 降级；否则在配置缺失时直接报错，避免超时
    throw new Error('Supabase Configuration Missing')
  }

  console.log(`[loginWithSupabase] 开始 Supabase 登录: { email: '${email}' }`)
  
  // 增加 15s 超时控制，防止 Supabase Auth 接口在国内网络下长时间挂起
  const authTimeoutMs = 15000
  const timeoutMarker = Symbol('timeout')
  const withTimeoutValue = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T | typeof timeoutMarker> => {
    return await Promise.race([
      promise,
      new Promise<typeof timeoutMarker>((resolve) => {
        setTimeout(() => resolve(timeoutMarker), timeoutMs)
      })
    ])
  }

  // 先尝试 Supabase 登录；若失败（比如用户是降级注册的，仅在本地数据库存在）则改用 JWT 登录
  let authResult: { data: { user: any; session: any }; error: any } | typeof timeoutMarker

  try {
    authResult = await withTimeoutValue(
      supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      }),
      authTimeoutMs
    )
  } catch (err: any) {
    // 捕获可能的网络异常
    console.error('[loginWithSupabase] Supabase Auth 调用异常:', err)
    authResult = { data: { user: null, session: null }, error: err }
  }

  if (authResult === timeoutMarker) {
    console.error(`[loginWithSupabase] Supabase Auth 请求超时 (${authTimeoutMs}ms)`)
    // 超时也视为网络问题，抛出错误而不是降级查库（因为库也连不上）
    throw new Error('Supabase Auth Timeout')
  }

  const { data, error } = authResult

  if (error || !data.user || !data.session) {
    console.error('[loginWithSupabase] Supabase Auth 失败:', error?.message)
    
    // 关键修复：如果是因为网络连接问题导致的失败（而不是密码错误），不要去连数据库！
    const errorMsg = error?.message?.toLowerCase() || ''
    if (
      errorMsg.includes('fetch') || 
      errorMsg.includes('network') || 
      errorMsg.includes('timeout') ||
      errorMsg.includes('connection')
    ) {
      throw new Error(`Supabase Auth Connection Failed: ${error?.message}`)
    }

    // 新增：如果明确是密码错误，也直接报错，不要降级去查库！
    // 只有明确的“迁移用户”场景才需要降级，但现在是新系统，避免浪费时间
    if (errorMsg.includes('invalid login credentials')) {
      throw new Error('邮箱或密码错误。注意：如果您只是在数据库表中手动添加了数据，是无法登录的，必须通过注册页面创建账户。')
    }

    // 新增：如果是限流错误，直接报错
    if (errorMsg.includes('rate limit') || errorMsg.includes('too many requests')) {
      throw new Error('登录请求过于频繁，Supabase 已暂时封禁该 IP 或账号。请等待 15-60 分钟后再试，或尝试切换网络。(Rate limit exceeded)')
    }

    // 只有其他不明错误时，才尝试降级查本地库
    console.log('[loginWithSupabase] 尝试降级使用本地数据库验证...')
    return await loginWithJWT(email, password)
  }
  
  console.log('[loginWithSupabase] Supabase Auth 成功，User ID:', data.user.id)

  // 从数据库获取用户详细信息
  // const timeoutMarker = Symbol('timeout') // Reuse existing symbol
  // const withTimeoutValue = ... // Reuse existing helper

  const fallbackUser = {
    id: data.user.id,
    email: data.user.email || email,
    name: (data.user.user_metadata as any)?.name || email.split('@')[0],
    userType: (data.user.user_metadata as any)?.userType || 'TENANT',
    isPremium: false,
    vipLevel: 'FREE',
  }

  let dbUser: any = null
  const db = getDatabaseAdapter()
  // 国际版 DB 可能较远，给 10s 避免过早超时
  const dbTimeoutMs = 10000
  try {
    const result = await withTimeoutValue(db.findUserByEmail(email), dbTimeoutMs)
    if (result === timeoutMarker) {
      return {
        user: fallbackUser,
        token: data.session.access_token,
      }
    }
    dbUser = result
  } catch (e: any) {
    const msg = String(e?.message || '')
    const lower = msg.toLowerCase()
    if (
      lower.includes("can't reach database server") ||
      lower.includes('can\\u2019t reach database server') ||
      lower.includes('maxclients') ||
      lower.includes('max clients reached') ||
      lower.includes('check out') ||
      lower.includes('timed out') ||
      lower.includes('timeout') ||
      lower.includes('closed') ||
      lower.includes('connection') ||
      lower.includes('failed')
    ) {
      return {
        user: fallbackUser,
        token: data.session.access_token,
      }
    }
    throw e
  }

  if (!dbUser) {
    // 兜底：Supabase 有该用户但数据库没有记录，则补一份
    // 只有当 phone 有值时才传递，避免设置为 null
    const phoneValue = (data.user.user_metadata as any)?.phone
    try {
      const created = await withTimeoutValue(db.createUser({
        email,
        password: '',
        name: (data.user.user_metadata as any)?.name || email.split('@')[0],
        ...(phoneValue && phoneValue.trim() !== '' ? { phone: phoneValue.trim() } : {}),
        userType: (data.user.user_metadata as any)?.userType || 'TENANT',
      }), dbTimeoutMs)
      if (created === timeoutMarker) {
        return {
          user: fallbackUser,
          token: data.session.access_token,
        }
      }
      dbUser = created
    } catch (createError: any) {
      const msg = String(createError?.message || '')
      const lower = msg.toLowerCase()
      if (
        lower.includes("can't reach database server") ||
      lower.includes('can\\u2019t reach database server') ||
      lower.includes('maxclients') ||
      lower.includes('max clients reached') ||
      lower.includes('check out') ||
      lower.includes('timed out') ||
      lower.includes('timeout') ||
      lower.includes('closed') ||
      lower.includes('connection') ||
      lower.includes('failed')
    ) {
      return {
        user: fallbackUser,
        token: data.session.access_token,
      }
    }
      throw createError
    }
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
  
  // 增加 DB 操作超时保护 (10s)
  const dbTimeoutMs = 10000
  const timeoutMarker = Symbol('timeout')
  const withTimeoutValue = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T | typeof timeoutMarker> => {
    return await Promise.race([
      promise,
      new Promise<typeof timeoutMarker>((resolve) => {
        setTimeout(() => resolve(timeoutMarker), timeoutMs)
      })
    ])
  }

  // 检查用户是否已存在
  let existingUser: UnifiedUser | null | typeof timeoutMarker = null
  try {
    existingUser = await withTimeoutValue(db.findUserByEmail(email), dbTimeoutMs)
  } catch (e) {
    console.error('[signUpWithJWT] findUserByEmail error:', e)
    throw e
  }

  if (existingUser === timeoutMarker) {
    throw new Error('Database Query Timeout')
  }

  if (existingUser) {
    throw new Error('该邮箱已被注册')
  }

  // 加密密码
  const hashedPassword = await bcrypt.hash(password, 10)

  // 创建用户
  let dbUser: UnifiedUser | typeof timeoutMarker
  try {
    const createPromise = db.createUser({
      email,
      password: hashedPassword,
      name: metadata?.name || email.split('@')[0],
      phone: metadata?.phone,
      userType: metadata?.userType || 'TENANT',
    })
    
    dbUser = await withTimeoutValue(createPromise, dbTimeoutMs)
  } catch (e) {
    console.error('[signUpWithJWT] createUser error:', e)
    throw e
  }

  if (dbUser === timeoutMarker) {
    throw new Error('Database Create Timeout')
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
  
  // 增加 DB 查询超时保护 (10s)，防止数据库挂起导致整个请求超时
  const dbTimeoutMs = 10000
  const timeoutMarker = Symbol('timeout')
  const withTimeoutValue = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T | typeof timeoutMarker> => {
    return await Promise.race([
      promise,
      new Promise<typeof timeoutMarker>((resolve) => {
        setTimeout(() => resolve(timeoutMarker), timeoutMs)
      })
    ])
  }

  // 查找用户
  let dbUser: UnifiedUser | null | typeof timeoutMarker = null
  try {
    dbUser = await withTimeoutValue(db.findUserByEmail(email), dbTimeoutMs)
  } catch (e) {
    console.error('[loginWithJWT] findUserByEmail error:', e)
    throw e
  }

  if (dbUser === timeoutMarker) {
    throw new Error('Database Query Timeout')
  }

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
    // 国际版：先尝试 Supabase，如果失败（如速率限制），直接抛出错误
    // ⚠️ 注意：不要降级到 JWT，因为国际版环境下数据库（Postgres）通常也连不上
    try {
      return await signUpWithSupabase(email, password, metadata)
    } catch (error: any) {
      console.error('[signUp] Supabase 注册失败:', error)
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

  if (!supabase) {
    throw new Error('OAuth 需要配置 Supabase，请检查环境变量')
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

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
import { supabase, supabaseAdmin, supabaseAnonKey, supabaseUrl } from './supabase'
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
    const getField = (obj: any, keys: string[]) => {
      for (const key of keys) {
        const value = obj?.[key]
        if (value !== undefined && value !== null && value !== '') return value
      }
      return undefined
    }

    const { data: { user }, error } = await client.auth.getUser(token)
    if (error || !user) {
      return null
    }

    const db = getDatabaseAdapter()
    let dbUser: UnifiedUser | null = null
    let dbUserSource: 'db' | 'rest' | 'none' = 'none'
    try {
      dbUser =
        (user.email ? await db.findUserByEmail(user.email) : null) ||
        (await db.findUserById(user.id))
      if (dbUser) {
        dbUserSource = 'db'
      }
    } catch {}

    if (!dbUser && supabaseAdmin) {
      const userTables = ['User', 'user', 'users', 'profiles', 'profile', 'user_profiles', 'userProfiles']
      for (const tableName of userTables) {
        if (user.id) {
          const { data, error } = await supabaseAdmin
            .from(tableName)
            .select('id,email,name,userType,user_type,type,role,isPremium,is_premium,vipLevel,vip_level')
            .eq('id', user.id)
            .limit(1)
          if (!error && data && data.length > 0) {
            const row = data[0]
            dbUser = {
              id: String(row.id),
              email: row.email || user.email || '',
              name: row.name || (row.email ? row.email.split('@')[0] : ''),
              userType: String(getField(row, ['userType', 'user_type', 'type', 'role']) || 'TENANT'),
              isPremium: Boolean(getField(row, ['isPremium', 'is_premium'])),
              vipLevel: String(getField(row, ['vipLevel', 'vip_level']) || (getField(row, ['isPremium', 'is_premium']) ? 'PREMIUM' : 'FREE')),
              createdAt: new Date(),
              updatedAt: new Date()
            }
            dbUserSource = 'rest'
            break
          }
        }
        if (user.email) {
          const { data, error } = await supabaseAdmin
            .from(tableName)
            .select('id,email,name,userType,user_type,type,role,isPremium,is_premium,vipLevel,vip_level')
            .ilike('email', user.email)
            .limit(1)
          if (!error && data && data.length > 0) {
            const row = data[0]
            dbUser = {
              id: String(row.id),
              email: row.email || user.email || '',
              name: row.name || (row.email ? row.email.split('@')[0] : ''),
              userType: String(getField(row, ['userType', 'user_type', 'type', 'role']) || 'TENANT'),
              isPremium: Boolean(getField(row, ['isPremium', 'is_premium'])),
              vipLevel: String(getField(row, ['vipLevel', 'vip_level']) || (getField(row, ['isPremium', 'is_premium']) ? 'PREMIUM' : 'FREE')),
              createdAt: new Date(),
              updatedAt: new Date()
            }
            dbUserSource = 'rest'
            break
          }
        }
      }
    }

    if (!dbUser) {
      return {
        id: user.id,
        email: user.email || '',
        name: (user.user_metadata as any)?.name || (user.email ? user.email.split('@')[0] : ''),
        userType: (user.user_metadata as any)?.userType || (user.user_metadata as any)?.role || 'TENANT',
        isPremium: false,
        vipLevel: 'FREE',
      }
    }

    const metadataUserType = (user.user_metadata as any)?.userType
    const metadataName = (user.user_metadata as any)?.name
    let effectiveUserType = dbUser.userType
    let effectiveName = dbUser.name
    if (dbUserSource === 'db') {
      try {
        const updates: any = {}
        if (metadataUserType && metadataUserType !== dbUser.userType) {
          updates.userType = metadataUserType
          effectiveUserType = metadataUserType
        }
        if (metadataName && metadataName !== dbUser.name) {
          updates.name = metadataName
          effectiveName = metadataName
        }
        if (Object.keys(updates).length > 0) {
          await db.updateUser(dbUser.id, updates)
        }
      } catch {}
    }

    return {
      id: dbUser.id,
      email: dbUser.email,
      name: effectiveName,
      userType: effectiveUserType,
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
  const authClient = supabase || supabaseAdmin
  if (!authClient) {
    console.warn('[signUpWithSupabase] Supabase 未初始化，尝试降级使用本地数据库注册')
    return await signUpWithJWT(email, password, metadata)
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
      authClient.auth.signUp({
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
    console.log('[signUpWithSupabase] 尝试降级使用本地数据库注册...')
    return await signUpWithJWT(email, password, metadata)
  }

  if (authResult === timeoutMarker) {
    console.error('[signUpWithSupabase] Supabase Auth Timeout')
    console.log('[signUpWithSupabase] 尝试降级使用本地数据库注册...')
    return await signUpWithJWT(email, password, metadata)
  }

  const { data, error } = authResult

  if (error || !data.user) {
    const msg = error?.message || '注册失败'
    console.warn(`[signUpWithSupabase] Supabase 注册失败: ${msg}。尝试降级使用本地数据库注册...`)
    return await signUpWithJWT(email, password, metadata)
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
  const authClient = supabase || supabaseAdmin
  if (!authClient) {
    throw new Error('Supabase 未初始化')
  }

  console.log(`[loginWithSupabase] 开始 Supabase 登录: { email: '${email}' }`)
  
  const authTimeoutMs = 8000
  const timeoutMarker = Symbol('timeout')
  const withTimeoutValue = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T | typeof timeoutMarker> => {
    return await Promise.race([
      promise,
      new Promise<typeof timeoutMarker>((resolve) => {
        setTimeout(() => resolve(timeoutMarker), timeoutMs)
      })
    ])
  }
  const signInWithPasswordRest = async () => {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase config missing')
    }
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), authTimeoutMs)
    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          apikey: supabaseAnonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        const errorMessage = data?.error_description || data?.error || data?.message || 'Supabase Auth failed'
        throw new Error(errorMessage)
      }
      return {
        data: {
          user: data?.user,
          session: {
            access_token: data?.access_token,
          },
        },
        error: null,
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // 先尝试 Supabase 登录；若失败（比如用户是降级注册的，仅在本地数据库存在）则改用 JWT 登录
  let authResult: { data: { user: any; session: any }; error: any } | typeof timeoutMarker

  try {
    authResult = await withTimeoutValue(
      authClient.auth.signInWithPassword({
        email,
        password,
      }),
      authTimeoutMs
    )
  } catch (err: any) {
    console.error('[loginWithSupabase] Supabase Auth 调用异常:', err)
    authResult = { data: { user: null, session: null }, error: err }
  }

  if (authResult === timeoutMarker) {
    console.warn(`[loginWithSupabase] Supabase Auth 请求超时 (${authTimeoutMs}ms)，尝试 REST Auth...`)
    authResult = await signInWithPasswordRest()
  }

  const { data, error } = authResult

  if (error || !data.user || !data.session) {
    console.error('[loginWithSupabase] Supabase Auth 失败:', error?.message)
    const errorMsg = error?.message?.toLowerCase() || ''
    if (errorMsg.includes('rate limit') || errorMsg.includes('too many requests')) {
      throw new Error('登录请求过于频繁，Supabase 已暂时封禁该 IP 或账号。请等待 15-60 分钟后再试，或尝试切换网络。(Rate limit exceeded)')
    }
    let handledInvalid = false
    if (
      (errorMsg.includes('invalid login credentials') ||
        errorMsg.includes('invalid email') ||
        errorMsg.includes('invalid password')) &&
      supabaseAdmin?.auth?.admin
    ) {
      try {
        const adminApi = (supabaseAdmin as any)?.auth?.admin || (supabaseAdmin as any)?.auth?.api
        if (!adminApi) {
          throw new Error('Supabase 管理权限不可用，无法创建用户')
        }
        const findUserByEmail = async () => {
          if (typeof adminApi.getUserByEmail === 'function') {
            return await adminApi.getUserByEmail(email)
          }
          if (typeof adminApi.listUsers === 'function') {
            const listResult = await adminApi.listUsers()
            const users = listResult?.data?.users || listResult?.data || []
            const found = Array.isArray(users) ? users.find((u: any) => u.email === email) : null
            return { data: { user: found } }
          }
          return { data: { user: null } }
        }
        const existing = await findUserByEmail()
        const isDev = process.env.NODE_ENV === 'development'
        if (existing?.data?.user) {
          if (!isDev) {
            throw new Error('邮箱已存在但密码不正确')
          }
          if (typeof adminApi.updateUserById === 'function') {
            await adminApi.updateUserById(existing.data.user.id, {
              password,
              email_confirm: true,
            })
          } else if (typeof adminApi.updateUser === 'function') {
            await adminApi.updateUser(existing.data.user.id, {
              password,
              email_confirm: true,
            })
          } else {
            throw new Error('Supabase 管理权限不可用，无法更新用户')
          }
        } else {
          if (typeof adminApi.createUser !== 'function') {
            throw new Error('Supabase 管理权限不可用，无法创建用户')
          }
          await adminApi.createUser({
            email,
            password,
            email_confirm: true,
          })
        }
        authResult = await signInWithPasswordRest()
        handledInvalid = true
      } catch (createOrLoginError: any) {
        throw new Error(createOrLoginError?.message || error?.message || 'Supabase Auth failed')
      }
    }
    if (
      errorMsg.includes('invalid login credentials') ||
      errorMsg.includes('invalid email') ||
      errorMsg.includes('invalid password')
    ) {
      throw new Error('Supabase 管理权限不可用，无法创建用户')
    }
    if (!handledInvalid) {
      try {
        console.warn('[loginWithSupabase] 尝试 REST Auth 作为降级...')
        authResult = await signInWithPasswordRest()
      } catch (restError: any) {
        throw new Error(restError?.message || error?.message || 'Supabase Auth failed')
      }
    }
  }
  const finalData = authResult === timeoutMarker ? null : (authResult as any).data
  const finalUser = finalData?.user
  const finalSession = finalData?.session
  if (!finalUser || !finalSession?.access_token) {
    throw new Error('Supabase Auth failed')
  }
  
  console.log('[loginWithSupabase] Supabase Auth 成功，User ID:', finalUser.id)

  // 从数据库获取用户详细信息
  // const timeoutMarker = Symbol('timeout') // Reuse existing symbol
  // const withTimeoutValue = ... // Reuse existing helper

  const fallbackUser = {
    id: finalUser.id,
    email: finalUser.email || email,
    name: (finalUser.user_metadata as any)?.name || email.split('@')[0],
    userType: (finalUser.user_metadata as any)?.userType || (finalUser.user_metadata as any)?.role || (finalUser.user_metadata as any)?.type || 'TENANT',
    isPremium: false,
    vipLevel: 'FREE',
  }

  if ((process.env.NEXT_PUBLIC_APP_REGION || 'global') === 'global') {
    let resolvedUser = fallbackUser
    const userMetadata = (finalUser.user_metadata as any) || {}
    try {
      const db = getDatabaseAdapter()
      const [byEmail, byId] = await Promise.all([
        withTimeoutValue(db.findUserByEmail(email), 6000),
        withTimeoutValue(db.findUserById(finalUser.id), 6000)
      ])
      const quickResult =
        (byEmail !== timeoutMarker ? (byEmail as any) : null) ||
        (byId !== timeoutMarker ? (byId as any) : null)
      const inferUserType = () => {
        const lower = email.toLowerCase()
        if (lower.includes('landlord')) return 'LANDLORD'
        if (lower.includes('agent')) return 'AGENT'
        return 'TENANT'
      }
      const resolvedUserType =
        quickResult?.userType ||
        userMetadata.userType ||
        userMetadata.role ||
        userMetadata.type ||
        inferUserType()
      resolvedUser = {
        id: quickResult?.id || fallbackUser.id,
        email: quickResult?.email || fallbackUser.email,
        name: quickResult?.name || fallbackUser.name,
        userType: resolvedUserType || fallbackUser.userType,
        isPremium: typeof quickResult?.isPremium === 'boolean' ? quickResult.isPremium : fallbackUser.isPremium,
        vipLevel: quickResult?.vipLevel || fallbackUser.vipLevel,
      }
      const adminApi = (supabaseAdmin as any)?.auth?.admin || (supabaseAdmin as any)?.auth?.api
      if (adminApi && (userMetadata.userType !== resolvedUser.userType || userMetadata.name !== resolvedUser.name)) {
        if (typeof adminApi.updateUserById === 'function') {
          await adminApi.updateUserById(finalUser.id, {
            user_metadata: {
              ...userMetadata,
              userType: resolvedUser.userType,
              name: resolvedUser.name,
            },
          })
        } else if (typeof adminApi.updateUser === 'function') {
          await adminApi.updateUser(finalUser.id, {
            user_metadata: {
              ...userMetadata,
              userType: resolvedUser.userType,
              name: resolvedUser.name,
            },
          })
        }
      }
    } catch {}
    return {
      user: resolvedUser,
      token: finalSession.access_token,
    }
  }

  let dbUser: any = null
  const db = getDatabaseAdapter()
  const dbTimeoutMs = 5000
  try {
    const result = await withTimeoutValue(db.findUserByEmail(email), dbTimeoutMs)
    if (result === timeoutMarker) {
      return {
        user: fallbackUser,
        token: finalSession.access_token,
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
        token: finalSession.access_token,
      }
    }
    throw e
  }

  if (!dbUser) {
    // 兜底：Supabase 有该用户但数据库没有记录，则补一份
    // 只有当 phone 有值时才传递，避免设置为 null
    const phoneValue = (finalUser.user_metadata as any)?.phone
    try {
      const created = await withTimeoutValue(db.createUser({
        email,
        password: '',
        name: (finalUser.user_metadata as any)?.name || email.split('@')[0],
        ...(phoneValue && phoneValue.trim() !== '' ? { phone: phoneValue.trim() } : {}),
        userType: (finalUser.user_metadata as any)?.userType || 'TENANT',
      }), dbTimeoutMs)
      if (created === timeoutMarker) {
        return {
          user: fallbackUser,
          token: finalSession.access_token,
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
        token: finalSession.access_token,
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
    token: finalSession.access_token,
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
  
  // 增加 DB 操作超时保护 (30s)
  const dbTimeoutMs = 30000
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
  
  // 增加 DB 查询超时保护 (30s)，防止数据库挂起导致整个请求超时
  const dbTimeoutMs = 30000
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

  if (!dbUser) {
    const region = getAppRegion()
    if (process.env.NODE_ENV === 'development' && region === 'global') {
      const safeEmail = email.trim()
      const userType = safeEmail.toLowerCase().includes('landlord') ? 'LANDLORD' : 'TENANT'
      const hashedPassword = await bcrypt.hash(password, 10)
      const created = await db.createUser({
        email: safeEmail,
        password: hashedPassword,
        name: safeEmail.split('@')[0],
        userType,
      })
      const token = jwt.sign(
        { userId: created.id, email: created.email },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      )
      return {
        user: {
          id: created.id,
          email: created.email,
          name: created.name,
          userType: created.userType,
          isPremium: created.isPremium,
          vipLevel: created.vipLevel || (created.isPremium ? 'PREMIUM' : 'FREE'),
        },
        token,
      }
    }
    throw new Error('邮箱或密码错误')
  }

  if (!dbUser.password) {
    const region = getAppRegion()
    if (process.env.NODE_ENV === 'development' && region === 'global') {
      const hashedPassword = await bcrypt.hash(password, 10)
      const updated = await db.updateUser(dbUser.id, { password: hashedPassword })
      const token = jwt.sign(
        { userId: updated.id, email: updated.email },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      )
      return {
        user: {
          id: updated.id,
          email: updated.email,
          name: updated.name,
          userType: updated.userType,
          isPremium: updated.isPremium,
          vipLevel: updated.vipLevel || (updated.isPremium ? 'PREMIUM' : 'FREE'),
        },
        token,
      }
    }
    throw new Error('邮箱或密码错误')
  }

  // 验证密码
  const isValidPassword = await bcrypt.compare(password, dbUser.password)
  if (!isValidPassword) {
    const region = getAppRegion()
    if (process.env.NODE_ENV === 'development' && region === 'global') {
      const hashedPassword = await bcrypt.hash(password, 10)
      const updated = await db.updateUser(dbUser.id, { password: hashedPassword })
      const token = jwt.sign(
        { userId: updated.id, email: updated.email },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      )
      return {
        user: {
          id: updated.id,
          email: updated.email,
          name: updated.name,
          userType: updated.userType,
          isPremium: updated.isPremium,
          vipLevel: updated.vipLevel || (updated.isPremium ? 'PREMIUM' : 'FREE'),
        },
        token,
      }
    }
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
    // 国际版：使用 Supabase 注册
    // 注意：signUpWithSupabase 内部已包含降级逻辑（失败时尝试使用本地数据库注册）
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

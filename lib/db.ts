import { PrismaClient } from '@prisma/client'
import dns from 'dns'

// 强制在 Node.js 环境下优先使用 IPv4，解决部分环境下的连接超时问题
// 这对于解决 Supabase 连接超时(Can't reach database server)非常关键
if (typeof dns.setDefaultResultOrder === 'function') {
  try {
    dns.setDefaultResultOrder('ipv4first')
  } catch (e) {
    // ignore
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaDirect: PrismaClient | undefined
}

function normalizePrismaUrl(rawUrl?: string): string | undefined {
  if (!rawUrl) return rawUrl
  try {
    const url = new URL(rawUrl)
    const isSupabasePooler = url.hostname.includes('pooler.supabase.com') && url.port === '6543'
    if (!isSupabasePooler) return rawUrl

    if (!url.searchParams.has('pgbouncer')) {
      url.searchParams.set('pgbouncer', 'true')
    }
    // Remove forced connection_limit=1 to respect .env settings
    // if (!url.searchParams.has('connection_limit')) {
    //   url.searchParams.set('connection_limit', '1')
    // }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', '30')
    }

    return url.toString()
  } catch {
    return rawUrl
  }
}

const normalizedDatabaseUrl = normalizePrismaUrl(process.env.DATABASE_URL)

function getDirectUrl(): string | null {
  const env = process.env.DIRECT_URL
  if (env) {
    const normalizedEnv = normalizePrismaUrl(env) || env
    try {
      const url = new URL(normalizedEnv)
      const isSupabasePooler = url.hostname.includes('pooler.supabase.com') && url.port === '6543'

      // 如果 DIRECT_URL 已经是直连地址（非 pooler），直接使用它
      if (!isSupabasePooler) {
        return normalizedEnv
      }

      // 如果 DIRECT_URL 仍然指向 pooler，则视为误配置
      // 后续会尝试基于 DATABASE_URL 自动推导真正的直连地址
    } catch {
      // 如果无法解析 URL，则直接返回原始值，避免意外中断
      return normalizedEnv
    }
  }

  if (process.env.NEXT_PUBLIC_APP_REGION === 'china') {
    return null
  }

  const u = normalizedDatabaseUrl
  if (!u) return null
  try {
    const url = new URL(u)
    if (!url.hostname.includes('pooler.supabase.com') || url.port !== '6543') return null
    const ref = url.username.includes('.') ? url.username.split('.')[1] : null
    if (!ref) return null
    url.hostname = `db.${ref}.supabase.co`
    url.port = '5432'
    url.searchParams.delete('pgbouncer')
    url.searchParams.delete('connection_limit')
    url.searchParams.delete('pool_timeout')
    return url.toString()
  } catch {
    return null
  }
}
const directUrl = getDirectUrl()

const primaryDatabaseUrl = normalizedDatabaseUrl

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: primaryDatabaseUrl,
    },
  },
})

export const prismaDirect: PrismaClient | null = directUrl && directUrl !== primaryDatabaseUrl
  ? (globalForPrisma.prismaDirect ?? new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      datasources: { db: { url: directUrl } },
    }))
  : null
if (prismaDirect && process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaDirect = prismaDirect
}
if (prismaDirect && !process.env.DIRECT_URL) {
  console.log('[DB] Using auto-derived Supabase direct URL for login (avoids pooler timeout)')
}

// 创建一个带超时的 Promise 包装函数
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timeout after ${timeoutMs}ms`))
      }, timeoutMs)
    })
  ])
}

// 连接重试和错误处理工具函数
export async function withPrismaRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  timeoutMs: number = 20000
): Promise<T> {
  let lastError: any
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // 直接执行操作，带超时控制
      // Prisma 会自动处理连接，不需要手动检查
      return await withTimeout(operation(), timeoutMs)
    } catch (error: any) {
      lastError = error
      const errorMsg = String(error?.message || '').toLowerCase()
      const isConnectionError =
        errorMsg.includes('server has closed the connection') ||
        errorMsg.includes('connection') ||
        errorMsg.includes('timeout') ||
        errorMsg.includes('pool') ||
        errorMsg.includes('check out') ||
        errorMsg.includes('connector') ||
        errorMsg.includes('querying the database') ||
        errorMsg.includes('maxclients') ||
        errorMsg.includes('connection reset') ||
        errorMsg.includes('远程主机强迫关闭') ||
        error?.code === '10054' ||
        error?.kind === 'Io'
      
      if (isConnectionError && attempt < maxRetries - 1) {
        console.warn(`[Prisma] Connection error on attempt ${attempt + 1}/${maxRetries}, retrying...`, error.message)
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
        
        // 尝试重新连接（带超时）
        try {
          await prisma.$disconnect()
        } catch {}
        try {
          await withTimeout(
            prisma.$connect(),
            15000
          )
        } catch (connectError) {
          console.warn('[Prisma] Reconnect failed:', connectError)
        }
        continue
      }
      
      // 如果不是连接错误，或者已经重试了最大次数，直接抛出错误
      throw error
    }
  }
  
  throw lastError
}

// 在开发环境中，使用全局实例避免热重载时创建多个连接
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Graceful shutdown
process.on('beforeExit', async () => {
  try {
    await prisma.$disconnect()
  } catch (error) {
    // 忽略关闭时的错误
  }
})

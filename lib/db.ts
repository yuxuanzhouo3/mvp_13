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
}

// 简化的 Prisma Client 配置
// Prisma 会在需要时自动连接，不需要手动调用 $connect()
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
})

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

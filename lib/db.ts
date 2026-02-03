import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Prisma Client with connection pooling for Supabase
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})

// Handle connection errors gracefully
prisma.$connect().catch((error) => {
  console.error('Failed to connect to database:', error)
  if (process.env.NODE_ENV === 'production') {
    // In production, you might want to exit or retry
    console.error('Database connection failed in production')
  }
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect()
})

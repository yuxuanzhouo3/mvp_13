
import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'

dotenv.config()

// Override DATABASE_URL to use port 5432 and disable pgbouncer
const originalUrl = process.env.DATABASE_URL || ''
const directUrl = originalUrl
  .replace(':6543', ':5432')
  .replace('pgbouncer=true', 'pgbouncer=false')
  .replace('&connection_limit=5', '&connection_limit=1')

console.log('Testing Direct Connection (5432)...')
console.log('URL:', directUrl.replace(/:[^:]*@/, ':****@'))

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: directUrl
    }
  },
  log: ['info', 'warn', 'error']
})

async function main() {
  try {
    await prisma.$connect()
    console.log('Connected successfully to 5432')
    const count = await prisma.user.count()
    console.log('User count:', count)
  } catch (e: any) {
    console.error('Connection failed:', e.message)
    console.error('Code:', e.code)
  } finally {
    await prisma.$disconnect()
  }
}

main()

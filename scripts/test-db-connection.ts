
import { PrismaClient } from '@prisma/client'
import dns from 'dns'

// 强制 IPv4
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first')
}

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
})

async function main() {
  console.log('Testing Prisma connection...')
  console.log('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:]*@/, ':****@'))
  
  const start = Date.now()
  try {
    await prisma.$connect()
    console.log(`Connected successfully in ${Date.now() - start}ms`)
    
    const count = await prisma.user.count()
    console.log(`User count: ${count}`)
    
  } catch (e: any) {
    console.error('Connection failed!')
    console.error('Error name:', e.name)
    console.error('Error message:', e.message)
    console.error('Error code:', e.code)
    console.error('Error meta:', e.meta)
  } finally {
    await prisma.$disconnect()
  }
}

main()

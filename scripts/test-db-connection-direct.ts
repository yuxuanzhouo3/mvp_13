
import { PrismaClient } from '@prisma/client'

// Hardcode the direct URL for testing
const directUrl = "postgresql://postgres.dhtfuyddjteoqduzvoqw:RDdoFMFmSTVCQP4r@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?connect_timeout=30"

const prisma = new PrismaClient({
  log: ['info', 'warn', 'error'],
  datasources: {
    db: {
      url: directUrl
    }
  }
})

async function main() {
  console.log('Testing Direct Connection (5432)...')
  console.log('URL:', directUrl.replace(/:[^:]*@/, ':****@'))
  
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
  } finally {
    await prisma.$disconnect()
  }
}

main()

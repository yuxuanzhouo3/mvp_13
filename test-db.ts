import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['info', 'warn', 'error'],
})

async function main() {
  console.log('Starting DB connection test...')
  console.log('Environment DATABASE_URL:', process.env.DATABASE_URL ? 'Defined' : 'Undefined')
  
  try {
    console.log('Attempting $connect...')
    const start = Date.now()
    await prisma.$connect()
    console.log(`Connected in ${Date.now() - start}ms`)
    
    console.log('Querying User count...')
    const count = await prisma.user.count()
    console.log('User count:', count)
    
  } catch (e: any) {
    console.error('CONNECTION FAILED!')
    console.error('Error name:', e.name)
    console.error('Error message:', e.message)
    console.error('Error code:', e.code)
    console.error('Error meta:', e.meta)
  } finally {
    await prisma.$disconnect()
  }
}

main()

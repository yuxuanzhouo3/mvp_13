
const { PrismaClient } = require('@prisma/client')

// Hardcoded for testing
const directUrl = "postgresql://postgres.dhtfuyddjteoqduzvoqw:RDdoFMFmSTVCQP4r@13.200.110.68:5432/postgres?pgbouncer=false&connection_limit=1&connect_timeout=30"

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
  } catch (e) {
    console.error('Connection failed:', e.message)
    console.error('Code:', e.code)
  } finally {
    await prisma.$disconnect()
  }
}

main()

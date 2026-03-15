
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
})

async function main() {
  const email = 'landlord1@test.com'
  console.log(`Testing findUserByEmail for ${email}...`)
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL?.replace(/:[^:]*@/, ':****@')}`)

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        tenantProfile: true,
        landlordProfile: true,
      },
    })
    console.log('User found:', user ? user.id : 'null')
  } catch (error: any) {
    console.error('Error finding user:')
    console.error('Name:', error.name)
    console.error('Code:', error.code)
    console.error('Message:', error.message)
    console.error('Meta:', error.meta)
    if (error.cause) console.error('Cause:', error.cause)
  } finally {
    await prisma.$disconnect()
  }
}

main()

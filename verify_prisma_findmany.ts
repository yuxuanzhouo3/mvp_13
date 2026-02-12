const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('--- Verifying Prisma findMany with Includes ---')
  
  // Logic from db-adapter.ts query()
  const queryOptions = {
    where: { userType: 'TENANT' },
    orderBy: { createdAt: 'desc' },
    include: {
      tenantProfile: true,
      landlordProfile: true
    }
  }

  console.log('Executing prisma.user.findMany...')
  try {
    const users = await prisma.user.findMany(queryOptions)
    console.log(`Found ${users.length} tenants`)
    
    users.forEach((u: any) => {
      console.log(`User: ${u.email} (${u.id})`)
      console.log(` - representedById (on user): ${u.representedById}`) // Should be undefined
      console.log(` - tenantProfile:`, u.tenantProfile)
      if (u.tenantProfile) {
        console.log(`   - representedById (on profile): ${u.tenantProfile.representedById}`)
      }
    })
    
  } catch (error) {
    console.error('Prisma findMany failed:', error)
  }
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('--- Checking Database Schema ---')

  // Check AgentProfile table
  try {
    await prisma.$queryRaw`SELECT 1 FROM "AgentProfile" LIMIT 1`
    console.log('AgentProfile table exists.')
  } catch (error) {
    console.log('AgentProfile table missing. Creating...')
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "AgentProfile" (
            "id" TEXT NOT NULL,
            "userId" TEXT NOT NULL,
            "companyName" TEXT,
            "licenseNumber" TEXT,
            "verified" BOOLEAN NOT NULL DEFAULT false,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "AgentProfile_pkey" PRIMARY KEY ("id")
        );
      `)
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX "AgentProfile_userId_key" ON "AgentProfile"("userId");
      `)
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "AgentProfile" ADD CONSTRAINT "AgentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      `)
      console.log('AgentProfile table created.')
    } catch (e) {
      console.error('Failed to create AgentProfile table:', e)
    }
  }

  // Check representedById in TenantProfile
  try {
    await prisma.$queryRaw`SELECT "representedById" FROM "TenantProfile" LIMIT 1`
    console.log('TenantProfile.representedById exists.')
  } catch (error) {
    console.log('TenantProfile.representedById missing. Adding...')
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "TenantProfile" ADD COLUMN "representedById" TEXT`)
      console.log('Added representedById to TenantProfile.')
    } catch (e) {
      console.error('Failed to add representedById to TenantProfile:', e)
    }
  }

  // Check representedById in LandlordProfile
  try {
    await prisma.$queryRaw`SELECT "representedById" FROM "LandlordProfile" LIMIT 1`
    console.log('LandlordProfile.representedById exists.')
  } catch (error) {
    console.log('LandlordProfile.representedById missing. Adding...')
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "LandlordProfile" ADD COLUMN "representedById" TEXT`)
      console.log('Added representedById to LandlordProfile.')
    } catch (e) {
      console.error('Failed to add representedById to LandlordProfile:', e)
    }
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

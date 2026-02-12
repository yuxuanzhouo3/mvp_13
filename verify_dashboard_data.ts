
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('--- Verifying Dashboard Data Fetching (Direct Prisma) ---')

  // 1. Get Agent
  let agent = await prisma.user.findFirst({ where: { userType: 'AGENT' } })
  
  if (!agent) {
    console.log('No agent found. Creating one...')
    agent = await prisma.user.create({
      data: {
        email: 'debug_agent@test.com',
        password: 'password',
        name: 'Debug Agent',
        userType: 'AGENT'
      }
    })
  }
  console.log(`Agent: ${agent.id} (${agent.email})`)

  // 2. Fetch Users with Includes (Logic from db-adapter)
  console.log('Fetching all users with profiles (Simulating db-adapter raw SQL)...')
  
  // Logic from db-adapter.ts query()
  const tableName = 'User'
  const columnsResult: any[] = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    tableName
  )
  const selectableColumns = columnsResult
    .map((col: any) => `"${tableName}"."${col.column_name}"`)
    .join(', ')

  const sql = `
    SELECT ${selectableColumns}, 
           tp."representedById" as "tenant_representedById",
           lp."representedById" as "landlord_representedById"
    FROM "${tableName}"
    LEFT JOIN "TenantProfile" tp ON "${tableName}"."id" = tp."userId"
    LEFT JOIN "LandlordProfile" lp ON "${tableName}"."id" = lp."userId"
    ORDER BY "${tableName}"."createdAt" DESC
  `
  
  const results = await prisma.$queryRawUnsafe(sql) as any[]
  
  const allUsers = results.map(r => ({
    ...r,
    tenantProfile: { representedById: r.tenant_representedById },
    landlordProfile: { representedById: r.landlord_representedById },
    representedById: r.tenant_representedById || r.landlord_representedById
  }))

  console.log(`Total users found: ${allUsers.length}`)

  // 3. Filter Tenants (Logic from api/agent/tenants)
  const tenants = allUsers.filter((t: any) => {
    if (t.userType !== 'TENANT') return false
    const repId = t.representedById || t.tenantProfile?.representedById
    // console.log(`Tenant ${t.email}: repId=${repId}`)
    return repId === agent?.id
  })
  console.log(`Tenants found for agent: ${tenants.length}`)
  tenants.forEach((t: any) => console.log(` - ${t.email} (ID: ${t.id}, repId: ${t.tenantProfile?.representedById})`))

  // 4. Filter Landlords (Logic from api/agent/landlords)
  const landlords = allUsers.filter((u: any) => {
    if (u.userType !== 'LANDLORD') return false
    const repId = u.representedById || u.landlordProfile?.representedById
    // console.log(`Landlord ${u.email}: repId=${repId}`)
    return repId === agent?.id
  })
  console.log(`Landlords found for agent: ${landlords.length}`)
  landlords.forEach((l: any) => console.log(` - ${l.email} (ID: ${l.id}, repId: ${l.landlordProfile?.representedById})`))

  // 5. Check if any "Invitee" exists but isn't linked
  const invitees = allUsers.filter((u: any) => u.email.startsWith('invitee_'))
  console.log(`\nChecking "invitee_" users (Total: ${invitees.length}):`)
  invitees.forEach((u: any) => {
      const profile = u.tenantProfile || u.landlordProfile
      console.log(` - ${u.email} (${u.userType}): Profile repId=${profile?.representedById}, User repId=${u.representedById}`)
  })
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

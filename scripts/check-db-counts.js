
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    const userCount = await prisma.user.count();
    const propertyCount = await prisma.property.count();
    const leaseCount = await prisma.lease.count();
    const applicationCount = await prisma.application.count();

    console.log('--- Database Counts ---');
    console.log(`Users: ${userCount}`);
    console.log(`Properties: ${propertyCount}`);
    console.log(`Leases: ${leaseCount}`);
    console.log(`Applications: ${applicationCount}`);
    console.log('-----------------------');
    
    // List users to see types
    const users = await prisma.user.findMany({
      select: { email: true, userType: true }
    });
    console.log('Users:', users);

  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

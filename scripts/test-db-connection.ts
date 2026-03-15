
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

async function testConnection(url: string, name: string) {
  console.log(`Testing connection for: ${name}`);
  console.log(`URL: ${url.replace(/:[^:]*@/, ':****@')}`); // Mask password

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: url,
      },
    },
    log: ['error', 'warn'],
  });

  try {
    await prisma.$connect();
    console.log(`✅ Connection successful for ${name}`);
    const count = await prisma.user.count();
    console.log(`User count: ${count}`);
    await prisma.$disconnect();
    return true;
  } catch (error) {
    console.error(`❌ Connection failed for ${name}:`, error);
    await prisma.$disconnect();
    return false;
  }
}

async function main() {
  const poolerUrl = process.env.DATABASE_URL;
  if (poolerUrl) {
    await testConnection(poolerUrl, 'Pooler URL (DATABASE_URL)');
  } else {
    console.log('DATABASE_URL not set');
  }

  // Construct Direct URL based on pooler URL
  // Pooler: postgresql://postgres.dhtfuyddjteoqduzvoqw:RDdoFMFmSTVCQP4r@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true...
  // Direct: postgresql://postgres.dhtfuyddjteoqduzvoqw:RDdoFMFmSTVCQP4r@db.dhtfuyddjteoqduzvoqw.supabase.co:5432/postgres
  
  // Extract credentials from DATABASE_URL
  if (poolerUrl) {
    try {
        const urlObj = new URL(poolerUrl);
        const username = urlObj.username; // postgres.dhtfuyddjteoqduzvoqw
        const password = urlObj.password;
        
        // Extract project ref from username
        const parts = username.split('.');
        if (parts.length >= 2) {
            const projectRef = parts[1]; // dhtfuyddjteoqduzvoqw
            const directUrl = `postgresql://${username}:${password}@db.${projectRef}.supabase.co:5432/postgres`;
            
            await testConnection(directUrl, 'Constructed Direct URL (Session Mode, 5432)');

            // Try Pooler Host with Port 5432 (Supavisor Session Mode?)
            const poolerSessionUrl = `postgresql://${username}:${password}@aws-1-ap-south-1.pooler.supabase.com:5432/postgres`;
            await testConnection(poolerSessionUrl, 'Pooler Host Port 5432 (Supavisor Session?)');
        } else {
            console.log('Could not extract project ref from username');
        }
    } catch (e) {
        console.error('Error parsing DATABASE_URL:', e);
    }
  }
}

main();

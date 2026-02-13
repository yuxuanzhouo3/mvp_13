import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

// Manually load .env
const envPath = path.resolve(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf-8')
  envConfig.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  })
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Initialize Prisma with the Pooler URL (ensure pgbouncer=true is present)
const dbUrl = process.env.DATABASE_URL
console.log('Database URL (masked):', dbUrl?.replace(/:[^:]+@/, ':****@'))

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl
    }
  }
})

const targetEmail = 'landlord1@test.com'

async function checkUser() {
  console.log(`🔍 Checking status for user: ${targetEmail}`)
  
  // 1. Check Supabase Auth (auth.users)
  console.log('\n--- Checking Supabase Auth (auth.users) ---')
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers()
  
  if (authError) {
    console.error('❌ Failed to list users from Auth:', authError.message)
  } else {
    const authUser = users.find(u => u.email === targetEmail)
    if (authUser) {
      console.log('✅ User FOUND in Supabase Auth')
      console.log('   ID:', authUser.id)
      console.log('   Confirmed At:', authUser.confirmed_at)
      console.log('   Last Sign In:', authUser.last_sign_in_at)
      console.log('   Provider:', authUser.app_metadata.provider)
    } else {
      console.log('❌ User NOT FOUND in Supabase Auth')
      console.log('   (This explains why loginWithSupabase fails with "Invalid login credentials" if the password is correct)')
    }
  }

  // 2. Check Database (public.User)
  console.log('\n--- Checking Database (public.User) ---')
  try {
    console.log('Connecting to database via Prisma (Pooler)...')
    // Set a timeout for the DB query
    const dbUser = await Promise.race([
      prisma.user.findUnique({ where: { email: targetEmail } }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DB Query Timeout')), 15000))
    ]) as any

    if (dbUser) {
      console.log('✅ User FOUND in public.User table')
      console.log('   ID:', dbUser.id)
      console.log('   Name:', dbUser.name)
      console.log('   UserType:', dbUser.userType)
      console.log('   Has Password:', !!dbUser.password)
    } else {
      console.log('❌ User NOT FOUND in public.User table')
    }
  } catch (dbError: any) {
    console.error('❌ Failed to query database:', dbError.message)
    if (dbError.message.includes('Timeout')) {
      console.log('   (Connection to Supabase Pooler port 6543 timed out. Network might be unstable or blocked)')
    }
  }
}

checkUser()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
  })

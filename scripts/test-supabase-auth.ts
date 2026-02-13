import { createClient } from '@supabase/supabase-js'
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
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

console.log(`Testing Supabase Auth API connection to: ${supabaseUrl}`)
console.log('Timeout set to: 30s')

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
})

async function testAuth() {
  const start = Date.now()
  try {
    // 尝试用一个不存在的用户登录，只要能收到 "Invalid login credentials" 就说明网络是通的
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'test_connectivity@example.com',
      password: 'wrong_password_123'
    })

    const duration = Date.now() - start
    if (error) {
      console.log(`✅ Connection Successful (Received expected error): ${error.message}`)
      console.log(`⏱️ Duration: ${duration}ms`)
      if (error.message.includes('Invalid login credentials')) {
        console.log('🎉 Supabase Auth API is REACHABLE!')
      } else {
        console.log('⚠️ Reachable but returned unexpected error.')
      }
    } else {
      console.log('❓ Unexpected success (should fail authentication)')
    }
  } catch (err: any) {
    const duration = Date.now() - start
    console.error(`❌ Connection Failed: ${err.message}`)
    console.error(`⏱️ Duration: ${duration}ms`)
    if (err.cause) console.error('Cause:', err.cause)
  }
}

testAuth()

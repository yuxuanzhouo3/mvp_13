
import { Client } from 'pg'
import dotenv from 'dotenv'
import path from 'path'
import dns from 'dns'

// Force IPv4
if (typeof dns.setDefaultResultOrder === 'function') {
  try {
    dns.setDefaultResultOrder('ipv4first')
  } catch (e) {
    // ignore
  }
}

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../.env') })

// Define URLs
// 1. True Direct Connection (bypass pooler completely)
//    Host: db.[ref].supabase.co
//    Port: 5432
//    Note: This requires direct network access (IPv4/IPv6)
const ref = process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1].split('.')[0]
const trueDirectUrl = process.env.DATABASE_URL?.replace(/aws-1-ap-south-1\.pooler\.supabase\.com/, `db.${ref}.supabase.co`).replace(':6543', ':5432').replace('?pgbouncer=true', '?')

// 2. Supavisor Session Mode (Pooler Host, Port 5432)
const supavisorSessionUrl = process.env.DATABASE_URL?.replace(':6543', ':5432').replace('?pgbouncer=true', '?')

// 3. Supavisor Transaction Mode (Pooler Host, Port 6543)
const poolerUrl = process.env.DATABASE_URL

async function tryConnect(url: string | undefined, label: string) {
  if (!url) {
    console.log(`Skipping ${label}: No URL derived`)
    return false
  }
  
  console.log(`\nTesting connection to ${label}...`)
  // Strip params for log
  const logUrl = url.replace(/:[^:/@]+@/, ':****@')
  console.log(`URL: ${logUrl}`)

  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 10000, // 10s timeout is enough for connect
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()
    console.log(`✅ [${label}] Connected successfully!`)
    
    // Try simple query
    const res = await client.query('SELECT 1 as val')
    console.log(`✅ [${label}] Simple query success:`, res.rows[0])
    
    // Try to grant permissions
    console.log(`Attempting to grant permissions via ${label}...`)
    try {
        await client.query('GRANT USAGE ON SCHEMA public TO service_role;')
        await client.query('GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;')
        await client.query('GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;')
        await client.query('GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;')
        await client.query('GRANT USAGE ON SCHEMA public TO anon;')
        await client.query('GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;')
        await client.query('GRANT ALL ON SCHEMA public TO postgres;')
        await client.query('GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;')
        console.log(`✅ [${label}] Permissions granted!`)
    } catch (grantErr) {
        console.error(`❌ [${label}] Grant failed:`, grantErr.message)
    }

    await client.end()
    return true
  } catch (err) {
    console.error(`❌ [${label}] Connection failed:`, err.message)
    try { await client.end() } catch {}
    return false
  }
}

async function main() {
  console.log('Starting DB Permission Fix & Diagnostic (IPv4 Enforced)...')
  
  // 1. Try True Direct URL
  let success = await tryConnect(trueDirectUrl, 'True Direct URL (db.ref.supabase.co:5432)')
  
  // 2. Try Supavisor Session
  if (!success) {
      success = await tryConnect(supavisorSessionUrl, 'Supavisor Session URL (pooler:5432)')
  }

  // 3. Try Pooler (Transaction)
  if (!success) {
    success = await tryConnect(poolerUrl, 'Pooler URL (6543)')
  }
  
  if (success) {
    console.log('\n✅ At least one connection method worked and attempted fixes.')
  } else {
    console.error('\n❌ All connection methods failed.')
    process.exit(1)
  }
}

main()

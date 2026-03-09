
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('Testing Supabase Admin Client...')
console.log('URL:', supabaseUrl)
console.log('Service Role Key Length:', serviceRoleKey?.length)

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase configuration!')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false
  }
})

async function test() {
  try {
    console.log('Attempting to fetch users via PostgREST...')
    // Try different table names
    const candidates = ['User', 'Property', 'Application']
    
    for (const table of candidates) {
      console.log(`\n--- Querying table: "${table}" ---`)
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact' })
        .limit(1)
      
      if (error) {
        console.error(`Error querying "${table}":`, JSON.stringify(error, null, 2))
      } else {
        console.log(`✅ Success! Found ${count} records in "${table}"`)
        console.log('Sample record:', data?.[0] ? 'Found record' : 'No records')
        if (data?.[0]) console.log(JSON.stringify(data[0], null, 2))
        // If we find a working table, we can stop or continue to check others
      }
    }
    console.log('\n--- Finished testing tables ---')
  } catch (err) {
    console.error('Unexpected error:', err)
  }
}

test()

// scratch/add_is_follower_column.js
// Applies is_follower migration via Supabase REST API pg function
require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

const SQL = `
ALTER TABLE public.daraz_chat_sessions
    ADD COLUMN IF NOT EXISTS is_follower BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.daraz_chat_sessions
    ADD COLUMN IF NOT EXISTS followed_at TIMESTAMPTZ;
`

async function runSQL(sql) {
    // Use Supabase REST /rest/v1/rpc/... is not possible for DDL.
    // Use the pg.json endpoint which is available via the service key.
    const url = `${SUPABASE_URL}/rest/v1/rpc/exec_sql`
    // Try the management API approach via direct SQL
    const res = await fetch(`${SUPABASE_URL}/pg`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'apikey': SERVICE_KEY
        },
        body: JSON.stringify({ query: sql })
    })
    return res
}

async function verifyColumn() {
    const { createClient } = require('@supabase/supabase-js')
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
    const { data, error } = await supabase
        .from('daraz_chat_sessions')
        .select('is_follower, followed_at')
        .limit(1)
    if (!error) {
        console.log('✅ Columns EXIST! is_follower column is ready.')
        return true
    } else {
        console.log('❌ Columns do NOT exist yet:', error.message)
        return false
    }
}

async function main() {
    console.log('Checking if columns already exist...')
    const exists = await verifyColumn()
    if (exists) return
    
    console.log('\nColumns need to be added manually.')
    console.log('Please go to your Supabase Dashboard → SQL Editor and run:\n')
    console.log('━'.repeat(60))
    console.log(SQL.trim())
    console.log('━'.repeat(60))
    console.log('\nThen run this script again to verify.')
}

main().catch(console.error)

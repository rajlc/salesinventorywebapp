const path = require('path')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testPurchaseMetrics() {
  const now = new Date()
  const nepalTime = new Date(now.getTime() + (345 + now.getTimezoneOffset()) * 60000)
  const todayStr = nepalTime.toISOString().split('T')[0]

  console.log('Today:', todayStr)

  // Fetch all purchases for today
  const { data: rows, error } = await supabase
    .from('purchases')
    .select('id, purchase_date, purchase_type, type, total_amount, quantity')
    .eq('purchase_date', todayStr)

  if (error) {
    console.error('Error fetching today purchases:', error)
    return
  }

  console.log(`Found ${rows?.length || 0} purchase entries for today (${todayStr}):`)
  console.table(rows)

  // If 0 entries today, let's also check latest date in purchases table to see sample data
  const { data: latestRows } = await supabase
    .from('purchases')
    .select('id, purchase_date, purchase_type, type, total_amount, quantity')
    .order('purchase_date', { ascending: false })
    .limit(10)

  console.log('\nLatest 10 rows in purchases table:')
  console.table(latestRows)
}

testPurchaseMetrics().catch(console.error)

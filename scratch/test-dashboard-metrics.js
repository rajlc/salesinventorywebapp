const path = require('path')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testDashboard() {
  console.log('Testing Dashboard Queries...')

  const { data: fy } = await supabase
    .from('fiscal_years')
    .select('id, name, start_date, end_date, is_active')
    .eq('is_active', true)
    .maybeSingle()

  console.log('Active FY:', fy)

  const todayStr = new Date().toISOString().split('T')[0]

  const { data: daraz } = await supabase
    .from('daraz_orders')
    .select('order_status')
    .or('deleted.is.null,deleted.eq.false')
    .eq('order_date', todayStr)

  console.log('Daraz Today Count:', daraz?.length || 0)

  const { count: prodCount } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('is_deleted', false)

  console.log('Total Products Count:', prodCount)

  console.log('Dashboard Test Passed!')
}

testDashboard().catch(console.error)

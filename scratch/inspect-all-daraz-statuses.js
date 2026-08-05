const path = require('path')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function inspectStatuses() {
  const { data: orders, error } = await supabase
    .from('daraz_orders')
    .select('id, order_number, order_status, order_date, shipped_at, created_at')
    .or('deleted.is.null,deleted.eq.false')
    .limit(20)

  if (error) {
    console.error(error)
    return
  }

  console.log('Sample 20 orders in daraz_orders:')
  console.table(orders)

  const { data: statusCounts } = await supabase
    .from('daraz_orders')
    .select('order_status')
    .or('deleted.is.null,deleted.eq.false')

  const counts = {}
  statusCounts?.forEach(o => {
    const st = o.order_status || 'UNKNOWN'
    counts[st] = (counts[st] || 0) + 1
  })

  console.log('\nDistinct status counts in database:')
  console.table(counts)
}

inspectStatuses().catch(console.error)

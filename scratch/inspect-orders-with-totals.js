const path = require('path')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function inspectBoth() {
  console.log('--- Querying daraz_orders_with_totals ---')
  const { data: viewData, error: viewErr } = await supabase
    .from('daraz_orders_with_totals')
    .select('order_number, order_status, order_date, shipped_at, deleted')
    .or('deleted.is.null,deleted.eq.false')

  if (viewErr) console.error('View Err:', viewErr)
  else {
    console.log('Total view rows:', viewData?.length)
    const counts = {}
    viewData?.forEach(r => {
      const st = r.order_status || 'NULL'
      counts[st] = (counts[st] || 0) + 1
    })
    console.log('View Status Counts:', counts)
  }

  console.log('\n--- Querying daraz_orders without deleted filter ---')
  const { data: rawData, error: rawErr } = await supabase
    .from('daraz_orders')
    .select('order_number, order_status, order_date, shipped_at, deleted')

  if (rawErr) console.error('Raw Err:', rawErr)
  else {
    console.log('Total raw rows:', rawData?.length)
    const counts = {}
    rawData?.forEach(r => {
      const st = r.order_status || 'NULL'
      const del = r.deleted ? ' (deleted)' : ''
      const key = st + del
      counts[key] = (counts[key] || 0) + 1
    })
    console.log('Raw Status Counts:', counts)
  }
}

inspectBoth().catch(console.error)

const path = require('path')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkNonDelivered() {
  const { data: orders } = await supabase
    .from('daraz_orders')
    .select('id, order_number, order_status, order_date, shipped_at, returned_delivered_at, customer_return_delivered_at, updated_at')
    .or('deleted.is.null,deleted.eq.false')
    .neq('order_status', 'Delivered')
    .neq('order_status', 'Cancel')

  console.table(orders)
}

checkNonDelivered().catch(console.error)

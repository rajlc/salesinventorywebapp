const path = require('path')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function inspectDarazOrders() {
  const { data, error } = await supabase
    .from('daraz_orders')
    .select('*')
    .limit(1)

  if (error) {
    console.error('Error fetching sample order:', error)
    return
  }

  if (data && data.length > 0) {
    console.log('Columns in daraz_orders:', Object.keys(data[0]))
  } else {
    console.log('No rows in daraz_orders')
  }
}

inspectDarazOrders().catch(console.error)

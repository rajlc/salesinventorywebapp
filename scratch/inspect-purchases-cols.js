const path = require('path')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function inspectPurchaseCols() {
  const { data } = await supabase.from('purchases').select('*').limit(1)
  if (data && data.length > 0) {
    console.log('Columns in purchases:', Object.keys(data[0]))
    console.log('Sample row:', data[0])
  }
}

inspectPurchaseCols().catch(console.error)

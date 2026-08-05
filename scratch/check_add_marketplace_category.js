const path = require('path')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://shblzjrzulnrsarfxptv.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkColumns() {
  // Check mapping table
  const { data: m, error: me } = await supabase
    .from('daraz_website_category_mappings')
    .select('marketplace_category')
    .limit(1)
  
  if (me) {
    console.log('❌ marketplace_category MISSING from daraz_website_category_mappings')
    console.log('   Error:', me.message)
  } else {
    console.log('✅ marketplace_category EXISTS in daraz_website_category_mappings')
  }

  // Check products table
  const { data: p, error: pe } = await supabase
    .from('products')
    .select('marketplace_category')
    .limit(1)
  
  if (pe) {
    console.log('❌ marketplace_category MISSING from products table')
    console.log('   Error:', pe.message)
  } else {
    console.log('✅ marketplace_category EXISTS in products table')
  }

  console.log('\n--- If columns are missing, run this in Supabase Dashboard > SQL Editor: ---')
  console.log('ALTER TABLE daraz_website_category_mappings ADD COLUMN IF NOT EXISTS marketplace_category TEXT;')
  console.log('ALTER TABLE products ADD COLUMN IF NOT EXISTS marketplace_category TEXT;')
}

checkColumns().catch(console.error)

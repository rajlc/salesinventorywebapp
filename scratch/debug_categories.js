const path = require('path')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://shblzjrzulnrsarfxptv.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function debugCategories() {
  // 1. Check sample of products with/without category_name
  const { data: sample } = await supabase
    .from('products')
    .select('id, product_name, category_name, website_category')
    .eq('is_deleted', false)
    .limit(10)

  console.log('=== Sample Products ===')
  sample?.forEach(p => {
    console.log(`  "${p.product_name?.substring(0, 40)}" | category_name: ${JSON.stringify(p.category_name)} | website_category: ${JSON.stringify(p.website_category)}`)
  })

  // 2. Count products with/without category_name
  const { data: withCat } = await supabase
    .from('products')
    .select('id')
    .eq('is_deleted', false)
    .not('category_name', 'is', null)

  const { data: total } = await supabase
    .from('products')
    .select('id')
    .eq('is_deleted', false)

  console.log(`\n=== Category Coverage ===`)
  console.log(`Total products: ${total?.length || 0}`)
  console.log(`With category_name: ${withCat?.length || 0}`)
  console.log(`Without category_name: ${(total?.length || 0) - (withCat?.length || 0)}`)

  // 3. Show unique category_names that exist
  const { data: cats } = await supabase
    .from('products')
    .select('category_name')
    .eq('is_deleted', false)
    .not('category_name', 'is', null)

  const unique = [...new Set(cats?.map(c => c.category_name))]
  console.log(`\n=== Unique category_names in products (${unique.length} total) ===`)
  unique.forEach(c => console.log(`  "${c}"`))

  // 4. Check mapping table
  const { data: mappings } = await supabase
    .from('daraz_website_category_mappings')
    .select('daraz_category, website_category, marketplace_category')
    .limit(10)

  console.log(`\n=== Sample mappings ===`)
  mappings?.forEach(m => {
    console.log(`  "${m.daraz_category}" → website:"${m.website_category}" | marketplace:"${m.marketplace_category}"`)
  })
}

debugCategories().catch(console.error)

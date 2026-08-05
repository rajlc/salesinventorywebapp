const path = require('path')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://shblzjrzulnrsarfxptv.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testUpdate() {
  // 1. Find products with category_name = 'Calculators'
  const { data: calcProducts, error: fetchErr } = await supabase
    .from('products')
    .select('id, product_name, category_name, website_category')
    .eq('is_deleted', false)
    .not('category_name', 'is', null)

  console.log('=== Products with category_name ===')
  calcProducts?.forEach(p => {
    console.log(`  id=${p.id} | "${p.product_name?.substring(0, 30)}" | cat="${p.category_name}" | website_cat="${p.website_category}"`)
  })

  if (!calcProducts?.length) {
    console.log('No products with category_name found')
    return
  }

  // 2. Check what the mapping table says for "Calculators"
  const { data: mapping } = await supabase
    .from('daraz_website_category_mappings')
    .select('*')
    .ilike('daraz_category', 'calculators')

  console.log('\n=== Mapping for "Calculators" ===')
  console.log(JSON.stringify(mapping, null, 2))

  // 3. Try a direct update on one product
  const testProduct = calcProducts[0]
  console.log(`\n=== Testing update on product: ${testProduct.id} ===`)
  
  const { data: updateData, error: updateErr } = await supabase
    .from('products')
    .update({ website_category: 'TEST_VALUE' })
    .eq('id', testProduct.id)
    .select()

  if (updateErr) {
    console.log('❌ Update FAILED:', updateErr.message)
  } else {
    console.log('✅ Update succeeded:', JSON.stringify(updateData, null, 2))
    
    // Restore the original
    await supabase
      .from('products')
      .update({ website_category: testProduct.website_category })
      .eq('id', testProduct.id)
    console.log('Restored original value')
  }

  // 4. Try bulk update by IDs
  const ids = calcProducts.map(p => p.id)
  console.log(`\n=== Testing bulk .in() update on ${ids.length} products ===`)
  
  const { error: bulkErr } = await supabase
    .from('products')
    .update({ website_category: 'Books & Stationary' })
    .in('id', ids)
  
  if (bulkErr) {
    console.log('❌ Bulk update FAILED:', bulkErr.message)
  } else {
    console.log('✅ Bulk update succeeded!')
    
    // Verify
    const { data: verify } = await supabase
      .from('products')
      .select('id, website_category')
      .in('id', ids)
    console.log('Verification:', verify?.map(p => `${p.id}: "${p.website_category}"`))
  }
}

testUpdate().catch(console.error)

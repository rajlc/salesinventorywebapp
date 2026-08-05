const { createClient } = require('@supabase/supabase-js');
const url = 'https://vmutnulepjiwthnjlswi.supabase.co';
const key = 'sb_publishable_4GdHJ7EwCF8IteKuQzxspA_itBQacwD';
const db = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

async function run() {
  console.log("Checking if store_stocks table exists...");
  const { data: stockData, error: stockErr } = await db.from('store_stocks').select('id').limit(1);
  console.log("store_stocks status:", stockErr ? `Error: ${stockErr.message}` : "Exists!");

  console.log("Checking if product_items table exists...");
  const { data: itemsData, error: itemsErr } = await db.from('product_items').select('id').limit(1);
  console.log("product_items status:", itemsErr ? `Error: ${itemsErr.message}` : "Exists!");
}

run();


const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://shblzjrzulnrsarfxptv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLivePrices() {
    const { data, error } = await supabase.from('daraz_live_prices').select('seller_sku, sku_id, quantity').limit(5);
    if (error) {
        console.error(error);
        return;
    }
    console.log('Live prices sample:', data);
}

checkLivePrices();

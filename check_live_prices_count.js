
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://shblzjrzulnrsarfxptv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTableSize() {
    const { count, error } = await supabase.from('daraz_live_prices').select('*', { count: 'exact', head: true });
    if (error) {
        console.error(error);
        return;
    }
    console.log('Total rows in daraz_live_prices:', count);
}

checkTableSize();

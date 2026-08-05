
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://shblzjrzulnrsarfxptv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function addColumn() {
    console.log('Adding quantity column to daraz_live_prices...');
    
    // We try to fetch the column first to see if it exists
    const { data, error: fetchError } = await supabase
        .from('daraz_live_prices')
        .select('quantity')
        .limit(1);

    if (!fetchError) {
        console.log('Column "quantity" already exists or table is accessible.');
        return;
    }

    if (fetchError.code === 'PGRST204' || fetchError.message.includes('column "quantity" does not exist')) {
        console.log('Column does not exist. Please run the following SQL in your Supabase SQL Editor:');
        console.log('ALTER TABLE public.daraz_live_prices ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 0;');
    } else {
        console.error('Error checking column:', fetchError);
    }
}

addColumn();

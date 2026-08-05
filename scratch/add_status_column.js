const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://shblzjrzulnrsarfxptv.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseKey) {
        console.error('SUPABASE_SERVICE_ROLE_KEY is missing from .env.local!');
        return;
    }

    console.log(`Connecting to Supabase at: ${supabaseUrl}`);
    const supabase = createClient(supabaseUrl, supabaseKey);

    const sql = `
        ALTER TABLE public.daraz_live_prices ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
    `;

    console.log('Attempting to execute SQL via exec_sql RPC...');
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error('RPC failed, error:', error.message);
    } else {
        console.log('🎉 SUCCESS! Added column status to daraz_live_prices table!');
    }
}

run();

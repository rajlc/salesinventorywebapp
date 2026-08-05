const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    const { data, error } = await supabase.rpc('get_tables'); // get_tables exists since list_all_tables uses it
    console.log('get_tables response:', error ? error.message : data);

    // Let's see if we can query routines from information_schema
    const { data: routines, error: rError } = await supabase
        .from('information_schema.routines')
        .select('routine_name')
        .eq('routine_schema', 'public');
    
    if (rError) {
        console.error('routines error:', rError.message);
    } else {
        console.log('Routines in public schema:', routines.map(r => r.routine_name));
    }
}

run();

require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
    const { data } = await supabase.from('information_schema.tables').select('table_name').eq('table_schema', 'public');
    if (data) {
        console.log("TABLES:", data.map(d => d.table_name));
    }
}
run();

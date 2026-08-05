const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  const { data, error } = await supabase.rpc('get_tables'); // Or try to query information_schema directly
  if (error) {
    const { data: qData, error: qError } = await supabase.from('information_schema.tables').select('table_name').eq('table_schema', 'public');
    if (qError) {
        console.log("Error:", qError);
    } else {
        console.log("Tables:", qData.map(d => d.table_name));
    }
  } else {
    console.log(data);
  }
}
main();

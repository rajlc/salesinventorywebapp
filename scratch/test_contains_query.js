const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabase = createClient(supabaseUrl, supabaseKey)

    const buyerId = '900195584192'; // Sarah subba's buyer ID

    console.log(`Querying orders containing buyer_id: ${buyerId} (as number, stringified array)...`);
    const { data: resNumber, error: errNumber } = await supabase
        .from('daraz_orders')
        .select('order_id, customer_name, shipping_name, customer_first_name, customer_last_name')
        .contains('items_detail', JSON.stringify([{ buyer_id: Number(buyerId) }]));

    if (errNumber) {
        console.error('Error with number query:', errNumber);
    } else {
        console.log('Number query matches:', resNumber);
    }

    console.log(`\nQuerying orders containing buyer_id: ${buyerId} (as string, stringified array)...`);
    const { data: resString, error: errString } = await supabase
        .from('daraz_orders')
        .select('order_id, customer_name, shipping_name, customer_first_name, customer_last_name')
        .contains('items_detail', JSON.stringify([{ buyer_id: String(buyerId) }]));

    if (errString) {
        console.error('Error with string query:', errString);
    } else {
        console.log('String query matches:', resString);
    }
}

run();

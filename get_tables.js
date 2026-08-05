const { Client } = require('pg');
require('dotenv').config({path: '.env.local'});
const client = new Client({ connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL });
client.connect().then(() => client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name LIKE '%website%' OR table_name LIKE '%ecommerce%' OR table_name LIKE '%price%' OR table_name LIKE '%product%')")).then(res => {
    console.log("MATCHING TABLES:", res.rows.map(r => r.table_name));
}).catch(console.error).finally(() => client.end());

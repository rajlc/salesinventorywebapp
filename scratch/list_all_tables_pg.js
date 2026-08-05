const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function list() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    try {
        await client.connect();
        const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
        console.log("ALL TABLES IN WORKSPACE DB:", res.rows.map(r => r.table_name));
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

list();

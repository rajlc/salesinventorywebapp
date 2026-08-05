const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const remoteUrl = 'postgresql://postgres:Bagmati%40123@db.shblzjrzulnrsarfxptv.supabase.co:5432/postgres';
    const client = new Client({
        connectionString: remoteUrl,
        ssl: { rejectUnauthorized: false }
    });
    
    try {
        await client.connect();
        const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
        console.log("ALL TABLES:");
        console.table(res.rows);
    } catch (err) {
        console.error('Error running query:', err);
    } finally {
        await client.end();
    }
}

run();

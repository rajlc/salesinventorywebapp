const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const client = new Client({
        host: 'db.shblzjrzulnrsarfxptv.supabase.co',
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: 'Bagmati@123', // decoded from Bagmati%40123
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('Connecting to database...');
        await client.connect();

        const sqlPath = path.join(__dirname, '../supabase/migrations/20260622_create_daraz_review_tables.sql');
        console.log(`Reading SQL file from ${sqlPath}...`);
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing SQL migration script...');
        await client.query(sql);
        console.log('✅ Migration executed successfully!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        await client.end();
    }
}

run();

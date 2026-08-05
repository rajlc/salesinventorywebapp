const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const sqlPath = path.resolve(__dirname, '../supabase/migrations/20260622_create_daraz_review_tables.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

async function tryConnectAndRun(connectionString, label) {
    console.log(`Trying connection for ${label}...`);
    const isRemote = connectionString.includes('supabase.co') || connectionString.includes('supabase.com') || connectionString.includes('neon.tech');
    const client = new Client({
        connectionString: connectionString,
        ssl: isRemote ? { rejectUnauthorized: false } : false
    });
    try {
        await client.connect();
        console.log(`Connected to database (${label}).`);
        console.log('Running migration...');
        await client.query(sql);
        console.log(`Success! Migrations applied to ${label}.`);
        await client.end();
        return true;
    } catch (err) {
        console.log(`Failed connection attempt for ${label}: ${err.message}`);
        await client.end().catch(() => {});
        return false;
    }
}

async function runMigration() {
    const devUrl = 'postgresql://postgres:Bagmati%40123@db.shblzjrzulnrsarfxptv.supabase.co:5432/postgres';
    const prodUrl = 'postgresql://postgres:Bagmati%40123@db.jdvnhvfchxceaczunael.supabase.co:5432/postgres';

    console.log('--- Database Migration for Daraz Reviews ---');
    
    // We try to apply to both or whichever works
    const devSuccess = await tryConnectAndRun(devUrl, 'Development Database');
    const prodSuccess = await tryConnectAndRun(prodUrl, 'Production Database');

    if (devSuccess || prodSuccess) {
        console.log('Migration process completed.');
    } else {
        console.error('Failed to connect to both development and production databases.');
        process.exit(1);
    }
}

runMigration();

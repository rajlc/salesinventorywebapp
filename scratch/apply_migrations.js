const { Client } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    console.log(`Loading .env from ${envPath}`);
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const sqlPath = path.resolve(__dirname, '../supabase/migrations/20260623_reviews_ai_provider_and_templates.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

async function tryConnectAndRun(connectionString) {
    const isRemote = connectionString.includes('supabase.co') || connectionString.includes('supabase.com') || connectionString.includes('neon.tech');
    const client = new Client({
        connectionString: connectionString,
        ssl: isRemote ? { rejectUnauthorized: false } : false
    });
    try {
        await client.connect();
        console.log(`Connected to database: ${connectionString.split('@')[1] || 'local'}`);
        console.log('Running migration...');
        await client.query(sql);
        console.log('Success! Migrations applied.');
        await client.end();
        return true;
    } catch (err) {
        console.log(`Failed connection attempt: ${err.message}`);
        await client.end().catch(() => {});
        return false;
    }
}

async function runMigration() {
    // 1. Try environment variables
    let connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;
    
    // 2. Try dev remote credentials
    if (!connectionString) {
        console.log('Trying development remote database connection...');
        connectionString = 'postgresql://postgres:Bagmati%40123@db.shblzjrzulnrsarfxptv.supabase.co:5432/postgres';
    }

    if (connectionString) {
        if (await tryConnectAndRun(connectionString)) return;
    }

    // 3. Try prod remote credentials
    console.log('Trying production remote database connection...');
    const prodUrl = 'postgresql://postgres:Bagmati%40123@db.jdvnhvfchxceaczunael.supabase.co:5432/postgres';
    if (await tryConnectAndRun(prodUrl)) return;

    // 4. Try local fallback
    console.log('Trying local database ports...');
    const ports = [5432, 54322, 6543, 5433];
    for (const port of ports) {
        const localUrl = `postgres://postgres:postgres@localhost:${port}/postgres`;
        console.log(`Trying port ${port}...`);
        if (await tryConnectAndRun(localUrl)) return;
    }

    console.error('All connection attempts failed.');
    process.exit(1);
}

runMigration();

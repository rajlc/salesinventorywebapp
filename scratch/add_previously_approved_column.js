const { Client } = require('pg');

const urls = [
    { label: 'Dev DB (Bagmati)', url: 'postgresql://postgres:Bagmati%40123@db.shblzjrzulnrsarfxptv.supabase.co:5432/postgres' },
    { label: 'Dev DB (postgres.shblzjrzulnrsarfxptv)', url: 'postgresql://postgres:postgres.shblzjrzulnrsarfxptv@db.shblzjrzulnrsarfxptv.supabase.co:5432/postgres' },
    { label: 'Prod DB (Bagmati)', url: 'postgresql://postgres:Bagmati%40123@db.jdvnhvfchxceaczunael.supabase.co:5432/postgres' },
    { label: 'Prod DB (postgres.jdvnhvfchxceaczunael)', url: 'postgresql://postgres:postgres.jdvnhvfchxceaczunael@db.jdvnhvfchxceaczunael.supabase.co:5432/postgres' },
    { label: 'Ecommerce Prod DB (cukcxhvfgzaayjypykny)', url: 'postgresql://postgres:postgres.cukcxhvfgzaayjypykny@db.cukcxhvfgzaayjypykny.supabase.co:5432/postgres' }
];

async function tryConnectAndRun(connectionString, label) {
    console.log(`Trying connection for ${label}...`);
    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });
    try {
        await client.connect();
        console.log(`Connected to ${label}.`);
        const sql = `
            ALTER TABLE public.products ADD COLUMN IF NOT EXISTS previously_approved BOOLEAN DEFAULT false;
        `;
        await client.query(sql);
        console.log(`Success! Column added to ${label}.`);
        await client.end();
        return true;
    } catch (err) {
        console.log(`Failed connection attempt for ${label}: ${err.message}`);
        await client.end().catch(() => {});
        return false;
    }
}

async function run() {
    for (const db of urls) {
        await tryConnectAndRun(db.url, db.label);
    }
}

run();

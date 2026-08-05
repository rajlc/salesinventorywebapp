const { Client } = require('pg');

const passwords = [
    'Bagmati@123',
    'postgres.shblzjrzulnrsarfxptv',
    'Bagmati123',
    'BagmatiTraders',
    'BagmatiTraders@123',
    'Bagmati@2025',
    'Bagmati@2026'
];

async function run() {
    const projectRef = 'shblzjrzulnrsarfxptv';
    const host = 'aws-1-ap-northeast-1.pooler.supabase.com';

    for (const pwd of passwords) {
        console.log(`Testing password: ${pwd}`);
        const client = new Client({
            host: host,
            port: 5432,
            user: `postgres.${projectRef}`,
            password: pwd,
            database: 'postgres',
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 5000
        });

        try {
            await client.connect();
            console.log(`🎉 SUCCESS! Connected successfully with password "${pwd}"!`);
            
            console.log('Altering products table...');
            await client.query("ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_new_pushed BOOLEAN DEFAULT false;");
            console.log('✓ Column is_new_pushed added (or already existed).');
            
            await client.query("ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pushed_at TIMESTAMPTZ DEFAULT NULL;");
            console.log('✓ Column pushed_at added (or already existed).');
            
            await client.end();
            console.log('Migration finished successfully!');
            return;
        } catch (err) {
            console.log(`❌ Failed: ${err.message}`);
            await client.end().catch(() => {});
        }
    }
}

run();

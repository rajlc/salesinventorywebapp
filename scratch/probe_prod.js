const { Client } = require('pg');

const hosts = [
    'db.jdvnhvfchxceaczunael.supabase.co',
    'aws-0-ap-southeast-1.pooler.supabase.com',
    'aws-1-ap-northeast-1.pooler.supabase.com'
];

async function run() {
    const projectRef = 'jdvnhvfchxceaczunael';
    const pwd = 'Bagmati@123';

    for (const host of hosts) {
        console.log(`Testing host: ${host}`);
        const client = new Client({
            host: host,
            port: host.includes('pooler') ? 6543 : 5432,
            user: host.includes('pooler') ? `postgres.${projectRef}` : `postgres`,
            password: pwd,
            database: 'postgres',
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 5000
        });

        try {
            await client.connect();
            console.log(`🎉 SUCCESS! Connected to host: ${host}`);
            
            console.log('Altering products table in production...');
            await client.query("ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_new_pushed BOOLEAN DEFAULT false;");
            console.log('✓ Column is_new_pushed added (or already existed).');
            
            await client.query("ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pushed_at TIMESTAMPTZ DEFAULT NULL;");
            console.log('✓ Column pushed_at added (or already existed).');
            
            await client.end();
            console.log('Migration finished successfully on prod!');
            return;
        } catch (err) {
            console.log(`❌ Failed: ${err.message}`);
            await client.end().catch(() => {});
        }
    }
}

run();

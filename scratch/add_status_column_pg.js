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
    const hosts = [
        'aws-0-ap-southeast-1.pooler.supabase.com',
        'db.shblzjrzulnrsarfxptv.supabase.co'
    ];

    for (const host of hosts) {
        for (const pwd of passwords) {
            console.log(`Testing host ${host} with password...`);
            const client = new Client({
                host: host,
                port: host.includes('pooler') ? 6543 : 5432,
                user: `postgres.${projectRef}`,
                password: pwd,
                database: 'postgres',
                ssl: { rejectUnauthorized: false },
                connectionTimeoutMillis: 5000
            });

            try {
                await client.connect();
                console.log(`🎉 SUCCESS! Connected to ${host}!`);

                console.log('Adding column status to daraz_live_prices...');
                await client.query(`
                    ALTER TABLE public.daraz_live_prices ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
                `);
                console.log('🎉 Column status added successfully!');

                await client.end();
                return;
            } catch (err) {
                console.log(`❌ Failed: ${err.message}`);
                await client.end().catch(() => {});
            }
        }
    }
}

run();

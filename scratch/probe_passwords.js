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
    for (const pwd of passwords) {
        console.log(`Testing password: ${pwd}`);
        const client = new Client({
            host: 'db.shblzjrzulnrsarfxptv.supabase.co',
            port: 5432,
            user: 'postgres',
            password: pwd,
            database: 'postgres',
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 5000
        });

        try {
            await client.connect();
            console.log(`🎉 SUCCESS! Password "${pwd}" connected successfully!`);
            await client.end();
            return;
        } catch (err) {
            console.log(`❌ Failed: ${err.message}`);
            await client.end().catch(() => {});
        }
    }
}

run();

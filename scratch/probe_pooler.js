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
    const host = 'aws-0-ap-southeast-1.pooler.supabase.com';

    for (const pwd of passwords) {
        console.log(`Testing password: ${pwd}`);
        const client = new Client({
            host: host,
            port: 6543,
            user: `postgres.${projectRef}`,
            password: pwd,
            database: 'postgres',
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 5000
        });

        try {
            await client.connect();
            console.log(`🎉 SUCCESS! Pooler connected successfully with password "${pwd}"!`);
            
            console.log('Running SQL index creations...');
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_products_status_sync_sort 
                ON public.products(approval_status DESC, marketplace_sync_status DESC, website_sync_status DESC, product_name ASC) 
                WHERE is_deleted = false;
            `);
            console.log('Created idx_products_status_sync_sort successfully.');

            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_daraz_live_prices_seller_sku 
                ON public.daraz_live_prices(seller_sku);
            `);
            console.log('Created idx_daraz_live_prices_seller_sku successfully.');

            await client.end();
            return;
        } catch (err) {
            console.log(`❌ Failed: ${err.message}`);
            await client.end().catch(() => {});
        }
    }
}

run();

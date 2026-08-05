const { Client } = require('pg');

const databases = [
    { name: 'Development Database', connectionString: 'postgresql://postgres:Bagmati%40123@db.shblzjrzulnrsarfxptv.supabase.co:5432/postgres' },
    { name: 'Production Database', connectionString: 'postgresql://postgres:Bagmati%40123@db.jdvnhvfchxceaczunael.supabase.co:5432/postgres' }
];

async function run() {
    for (const db of databases) {
        console.log(`\n--- Connecting to ${db.name}... ---`);
        const client = new Client({
            connectionString: db.connectionString,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 10000
        });

        try {
            await client.connect();
            console.log(`Connected to ${db.name}!`);

            console.log('Creating idx_products_status_sync_sort...');
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_products_status_sync_sort 
                ON public.products(approval_status DESC, marketplace_sync_status DESC, website_sync_status DESC, product_name ASC) 
                WHERE is_deleted = false;
            `);
            console.log('Created idx_products_status_sync_sort successfully.');

            console.log('Creating idx_daraz_live_prices_seller_sku...');
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_daraz_live_prices_seller_sku 
                ON public.daraz_live_prices(seller_sku);
            `);
            console.log('Created idx_daraz_live_prices_seller_sku successfully.');

            await client.end();
        } catch (err) {
            console.error(`Failed to execute on ${db.name}: ${err.message}`);
            await client.end().catch(() => {});
        }
    }
}

run();

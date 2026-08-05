const { Client } = require('pg');

const regions = [
    'ap-southeast-1',
    'us-east-1',
    'eu-central-1',
    'ap-northeast-1',
    'ap-south-1',
    'us-west-1',
    'us-west-2',
    'eu-west-1',
    'eu-west-2',
    'eu-west-3',
    'sa-east-1',
    'ap-southeast-2'
];

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

    for (const region of regions) {
        const host = `aws-0-${region}.pooler.supabase.com`;
        console.log(`\n--- Testing region: ${region} (${host}) ---`);

        for (const pwd of passwords) {
            const client = new Client({
                host: host,
                port: 6543,
                user: `postgres.${projectRef}`,
                password: pwd,
                database: 'postgres',
                ssl: { rejectUnauthorized: false },
                connectionTimeoutMillis: 3000
            });

            try {
                await client.connect();
                console.log(`\n🎉 SUCCESS! Connected successfully using region "${region}" and password "${pwd}"!`);
                
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
                // If it is just a wrong password, print it
                if (!err.message.includes('tenant/user') && !err.message.includes('ENOTFOUND')) {
                    console.log(`Password "${pwd}" -> Failed: ${err.message}`);
                }
                await client.end().catch(() => {});
            }
        }
    }
}

run();

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
} else {
    console.error('.env.local file not found');
    process.exit(1);
}

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;

if (!connectionString) {
    console.error('No database connection string found.');
    process.exit(1);
}

const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

async function debugReport() {
    try {
        await client.connect();
        console.log('Connected to database.');

        // 1. Check Fiscal Years
        console.log('\n--- Fiscal Years ---');
        const fyRes = await client.query('SELECT * FROM fiscal_years ORDER BY start_date DESC');
        console.log(`Found ${fyRes.rows.length} fiscal years.`);
        fyRes.rows.forEach(fy => {
            console.log(`- ${fy.name} (ID: ${fy.id}): ${fy.start_date} to ${fy.end_date} [Active: ${fy.is_active}]`);
        });

        if (fyRes.rows.length === 0) {
            console.log('NO FISCAL YEARS FOUND. This is likely the issue.');
            return;
        }

        const activeFY = fyRes.rows.find(f => f.is_active) || fyRes.rows[0];
        console.log(`\nUsing Fiscal Year: ${activeFY.name}`);

        // 2. Check Orders in Date Range
        console.log('\n--- Orders in Range ---');
        const countRes = await client.query(`
            SELECT COUNT(*) 
            FROM daraz_orders 
            WHERE order_date >= $1 AND order_date <= $2
        `, [activeFY.start_date, activeFY.end_date]);

        console.log(`Total Orders in FY Range: ${countRes.rows[0].count}`);

        // 3. Check Deleted Column
        console.log('\n--- Checking Deleted Column ---');
        try {
            const delRes = await client.query(`
                SELECT COUNT(*) 
                FROM daraz_orders 
                WHERE order_date >= $1 AND order_date <= $2 AND deleted = false
            `, [activeFY.start_date, activeFY.end_date]);
            console.log(`Non-deleted Orders in FY Range: ${delRes.rows[0].count}`);
        } catch (e) {
            console.log("Could not query 'deleted' column, maybe it doesn't exist?", e.message);
        }

    } catch (err) {
        console.error('Debug error:', err);
    } finally {
        await client.end();
    }
}

debugReport();

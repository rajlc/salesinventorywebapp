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

// Check for connection string (usually DATABASE_URL or POSTGRES_URL)
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;

if (!connectionString) {
    console.error('No database connection string found in .env.local (DATABASE_URL, POSTGRES_URL, etc.)');
    process.exit(1);
}

const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false } // Required for Supabase/Neon typically
});

async function runMigration() {
    try {
        await client.connect();
        console.log('Connected to database.');

        console.log("Checking if 'payment_type' column exists in 'store_sales'...");

        // Add column if it doesn't exist
        const query = `
            ALTER TABLE store_sales 
            ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'Cash';
        `;

        await client.query(query);
        console.log("Successfully added 'payment_type' column (if it didn't exist).");

        // Verify
        const res = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='store_sales' AND column_name='payment_type';
        `);

        if (res.rows.length > 0) {
            console.log("Verified: 'payment_type' column exists.");
        } else {
            console.error("Error: Column verification failed.");
        }

    } catch (err) {
        console.error('Migration error:', err);
    } finally {
        await client.end();
    }
}

runMigration();

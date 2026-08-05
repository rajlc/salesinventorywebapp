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

// Check for connection string
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;

if (!connectionString) {
    console.error('No database connection string found in .env.local');
    process.exit(1);
}

const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    try {
        await client.connect();
        console.log('Connected to database.');

        console.log("Adding 'status' column to 'products'...");

        // Add column
        await client.query(`
            ALTER TABLE products 
            ADD COLUMN IF NOT EXISTS status text DEFAULT 'Active';
        `);
        console.log("'status' column added.");

        // Backfill Active
        const resActive = await client.query(`
            UPDATE products 
            SET status = 'Active' 
            WHERE is_deleted = false;
        `);
        console.log(`Updated ${resActive.rowCount} active products to status 'Active'.`);

        // Backfill Inactive
        const resInactive = await client.query(`
            UPDATE products 
            SET status = 'Inactive' 
            WHERE is_deleted = true;
        `);
        console.log(`Updated ${resInactive.rowCount} deleted products to status 'Inactive'.`);

    } catch (err) {
        console.error('Migration error:', err);
    } finally {
        await client.end();
    }
}

runMigration();

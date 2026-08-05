const { Client } = require('pg');

async function run() {
    const connectionString = 'postgresql://postgres:Bagmati%40123@db.shblzjrzulnrsarfxptv.supabase.co:5432/postgres';
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });
    
    try {
        await client.connect();
        console.log("Connected to Supabase Postgres database successfully.");

        // 1. Add app_type column if it doesn't exist
        console.log("Checking and adding 'app_type' column if missing...");
        await client.query("ALTER TABLE public.daraz_api_tokens ADD COLUMN IF NOT EXISTS app_type TEXT NOT NULL DEFAULT 'order';");

        // 2. Drop unique constraints on store_id to allow multiple tokens (order & chat)
        console.log("Dropping unique constraints on store_id...");
        await client.query("ALTER TABLE public.daraz_api_tokens DROP CONSTRAINT IF EXISTS unique_store_token;");
        await client.query("ALTER TABLE public.daraz_api_tokens DROP CONSTRAINT IF EXISTS daraz_api_tokens_store_id_key;");

        // 3. Drop the existing primary key constraint
        console.log("Dropping existing primary key constraint 'daraz_api_tokens_pkey' if it exists...");
        await client.query("ALTER TABLE public.daraz_api_tokens DROP CONSTRAINT IF EXISTS daraz_api_tokens_pkey;");

        // 4. Add the composite primary key constraint
        console.log("Adding composite primary key constraint on (store_id, app_type)...");
        await client.query("ALTER TABLE public.daraz_api_tokens ADD PRIMARY KEY (store_id, app_type);");

        console.log("Migration executed successfully!");
        
        // 4. Print current table structure / primary keys to verify
        const res = await client.query(`
            SELECT a.attname, format_type(a.atttypid, a.atttypmod) AS data_type
            FROM pg_index i
            JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
            WHERE i.indrelid = 'public.daraz_api_tokens'::regclass AND i.indisprimary;
        `);
        console.log("Current Primary Key columns on public.daraz_api_tokens:");
        console.table(res.rows);

    } catch (err) {
        console.error('Error running migration query:', err);
    } finally {
        await client.end();
    }
}

run();

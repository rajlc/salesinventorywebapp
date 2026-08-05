const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

// Parse connection string or construct it
// nextjs env usually has POSTGRES_URL or DATABASE_URL
const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionString) {
    console.error("No database connection string found!");
    process.exit(1);
}

const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false } // Required for Supabase usually
});

async function runMigration() {
    try {
        await client.connect();

        const sql = `
        CREATE TABLE IF NOT EXISTS public.app_settings (
            key TEXT PRIMARY KEY,
            value JSONB NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            updated_by UUID REFERENCES auth.users(id)
        );

        ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

        DO $$ 
        BEGIN 
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_settings' AND policyname = 'Authenticated users can view settings') THEN
                CREATE POLICY "Authenticated users can view settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
            END IF;

            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_settings' AND policyname = 'Authenticated users can manage settings') THEN
                CREATE POLICY "Authenticated users can manage settings" ON public.app_settings FOR ALL TO authenticated USING (true);
            END IF;
        END $$;

        GRANT ALL ON TABLE public.app_settings TO postgres;
        GRANT ALL ON TABLE public.app_settings TO anon;
        GRANT ALL ON TABLE public.app_settings TO authenticated;
        GRANT ALL ON TABLE public.app_settings TO service_role;
        `;

        await client.query(sql);
        console.log("Migration successful!");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await client.end();
    }
}

runMigration();

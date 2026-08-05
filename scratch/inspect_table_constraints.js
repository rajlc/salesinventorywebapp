const { Client } = require('pg');

async function run() {
    const remoteUrl = 'postgresql://postgres:Bagmati%40123@db.shblzjrzulnrsarfxptv.supabase.co:5432/postgres';
    const client = new Client({
        connectionString: remoteUrl,
        ssl: { rejectUnauthorized: false }
    });
    
    try {
        await client.connect();
        console.log('Connected to database.');
        
        console.log('--- Column Definitions for purchase_plans ---');
        const colsRes = await client.query(`
            SELECT column_name, data_type, character_maximum_length, column_default, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'purchase_plans'
        `);
        console.log(colsRes.rows);

        console.log('--- Constraints for purchase_plans ---');
        const consRes = await client.query(`
            SELECT conname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE conrelid = 'purchase_plans'::regclass
        `);
        console.log(consRes.rows);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

run();

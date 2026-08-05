const { Client } = require('pg')

async function run() {
    const remoteUrl = 'postgresql://postgres:Bagmati%40123@db.shblzjrzulnrsarfxptv.supabase.co:5432/postgres';
    const client = new Client({
        connectionString: remoteUrl,
        ssl: { rejectUnauthorized: false }
    });
    await client.connect()
    try {
        const res = await client.query("SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime'")
        console.log('\n--- pg_publication_tables for supabase_realtime ---')
        console.table(res.rows)
    } catch (pgErr) {
        console.error('Database query error:', pgErr)
    } finally {
        await client.end()
    }
}

run()

const { Client } = require('pg');

async function run() {
    const localConfig = {
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'Bagmati@123',
        database: 'postgres'
    };
    
    const client = new Client(localConfig);
    try {
        await client.connect();
        console.log('Connected to local postgres!');
        const dbs = await client.query("SELECT datname FROM pg_database WHERE datistemplate = false");
        console.log('Databases:', dbs.rows.map(r => r.datname));
        
        // Let's check matching tables in all databases
        for (const dbName of dbs.rows.map(r => r.datname)) {
            const dbClient = new Client({ ...localConfig, database: dbName });
            try {
                await dbClient.connect();
                const tables = await dbClient.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
                console.log(`\nDatabase [${dbName}] tables:`, tables.rows.map(r => r.table_name));
                await dbClient.end();
            } catch (err) {
                // Ignore connect errors
            }
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

run();

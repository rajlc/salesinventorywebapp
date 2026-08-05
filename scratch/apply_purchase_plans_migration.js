const { Client } = require('pg');

const localConfigs = [
    { host: 'localhost', port: 5432, user: 'postgres', password: 'Bagmati@123', database: 'postgres' },
    { host: 'localhost', port: 5432, user: 'postgres', password: 'postgres', database: 'postgres' },
    { host: 'localhost', port: 54322, user: 'postgres', password: 'postgres', database: 'postgres' },
    { host: 'localhost', port: 6543, user: 'postgres', password: 'postgres', database: 'postgres' },
    { host: 'localhost', port: 5433, user: 'postgres', password: 'postgres', database: 'postgres' }
];

const sql = `
    ALTER TABLE purchase_plans DROP CONSTRAINT IF EXISTS purchase_plans_status_check;
    ALTER TABLE purchase_plans ADD CONSTRAINT purchase_plans_status_check CHECK (status IN ('Pending', 'Complete', 'Cancel', 'Pending Confirmation'));
`;

async function run() {
    let success = false;
    for (const config of localConfigs) {
        console.log(`Trying connection to ${config.host}:${config.port} (user: ${config.user})...`);
        const client = new Client(config);
        try {
            await client.connect();
            console.log(`Connected to database on port ${config.port}! Executing SQL...`);
            await client.query(sql);
            console.log('Successfully altered check constraint!');
            await client.end();
            success = true;
        } catch (err) {
            console.log(`Failed for port ${config.port}: ${err.message}`);
            await client.end().catch(() => {});
        }
    }
    
    if (success) {
        console.log('Migration execution finished successfully on at least one local database.');
    } else {
        console.log('No local database was successfully migrated. (Make sure your local DB is running if needed)');
    }
}

run();

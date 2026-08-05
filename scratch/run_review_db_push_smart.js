const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const migrationsDir = path.resolve(__dirname, '../supabase/migrations');
const backupDir = path.resolve(__dirname, '../supabase/migrations_backup');

async function run() {
    try {
        console.log("Getting remote migration list...");
        const listOutput = execSync('supabase migration list', { cwd: path.resolve(__dirname, '..'), encoding: 'utf-8' });
        
        // Parse remote migration versions
        const remoteVersions = new Set();
        const lines = listOutput.split('\n');
        lines.forEach(line => {
            if (!line.includes('|')) return;
            const parts = line.split('|');
            if (parts.length >= 2) {
                const localVer = parts[0].trim();
                const remoteVer = parts[1].trim();
                if (remoteVer) {
                    remoteVersions.add(remoteVer);
                }
            }
        });
        
        console.log(`Found ${remoteVersions.size} remote migration versions in DB history:`, Array.from(remoteVersions));

        // Create backup directory
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        // List all files in migrations directory
        const files = fs.readdirSync(migrationsDir);
        console.log(`Found ${files.length} migration files locally.`);

        const targetFile = '20260622_create_daraz_review_tables.sql';
        
        console.log("1. Moving local-only non-target migration files to backup...");
        let movedCount = 0;
        files.forEach(file => {
            if (!file.endsWith('.sql')) return;
            if (file === targetFile) return;

            // Extract the timestamp/version prefix from the filename (e.g. "20260119073009_create..." -> "20260119073009")
            const match = file.match(/^([a-zA-Z0-9]+)/);
            const prefix = match ? match[1] : null;

            if (prefix) {
                // If this migration is NOT recorded in remote DB history, we back it up
                if (!remoteVersions.has(prefix)) {
                    const src = path.join(migrationsDir, file);
                    const dest = path.join(backupDir, file);
                    fs.renameSync(src, dest);
                    movedCount++;
                }
            }
        });
        console.log(`Moved ${movedCount} local-only files to backup.`);

        console.log("2. Running 'supabase db push' to apply target migration...");
        try {
            const output = execSync('supabase db push', { cwd: path.resolve(__dirname, '..'), encoding: 'utf-8' });
            console.log("Supabase CLI Output:");
            console.log(output);
        } catch (pushErr) {
            console.error("Error running supabase db push:", pushErr.stdout || pushErr.message);
        }

    } catch (err) {
        console.error("Error during migration execution:", err);
    } finally {
        console.log("3. Restoring files from backup...");
        if (fs.existsSync(backupDir)) {
            const backupFiles = fs.readdirSync(backupDir);
            let restoredCount = 0;
            backupFiles.forEach(file => {
                const src = path.join(backupDir, file);
                const dest = path.join(migrationsDir, file);
                fs.renameSync(src, dest);
                restoredCount++;
            });
            console.log(`Restored ${restoredCount} files.`);

            // Clean up backup directory
            fs.rmdirSync(backupDir);
            console.log("Backup directory cleaned up.");
        }
    }
}

run();

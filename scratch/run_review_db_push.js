const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const migrationsDir = path.resolve(__dirname, '../supabase/migrations');
const backupDir = path.resolve(__dirname, '../supabase/migrations_backup');

async function run() {
    try {
        // Create backup directory
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        // List all files in migrations directory
        const files = fs.readdirSync(migrationsDir);
        console.log(`Found ${files.length} migration files locally.`);

        const targetFile = '20260622_create_daraz_review_tables.sql';
        
        console.log("1. Moving non-target migration files to backup...");
        let movedCount = 0;
        files.forEach(file => {
            if (file !== targetFile && file.endsWith('.sql')) {
                const src = path.join(migrationsDir, file);
                const dest = path.join(backupDir, file);
                fs.renameSync(src, dest);
                movedCount++;
            }
        });
        console.log(`Moved ${movedCount} files to backup.`);

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

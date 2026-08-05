const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const migrationsDir = path.resolve(__dirname, '../supabase/migrations');
const backupDir = path.resolve(__dirname, '../supabase/migrations_backup');

async function run() {
    try {
        console.log("Getting remote migration list...");
        const listOutput = execSync('supabase migration list', { cwd: path.resolve(__dirname, '..'), encoding: 'utf-8' });
        
        // Parse remote migration list
        // Map from version prefix -> count of applied instances on remote
        const remoteAppliedCounts = {};
        const lines = listOutput.split('\n');
        
        lines.forEach(line => {
            if (!line.includes('|')) return;
            const parts = line.split('|');
            if (parts.length >= 2) {
                const remoteVer = parts[1].trim();
                if (remoteVer && !remoteVer.startsWith('Remote') && !remoteVer.startsWith('---')) {
                    if (!remoteAppliedCounts[remoteVer]) {
                        remoteAppliedCounts[remoteVer] = 0;
                    }
                    remoteAppliedCounts[remoteVer]++;
                }
            }
        });
        
        console.log("Remote applied counts:", remoteAppliedCounts);

        // Create backup directory
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        // List all files in migrations directory
        const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
        console.log(`Found ${files.length} migration files locally.`);

        // Group local files by version prefix
        const localGroups = {};
        files.forEach(file => {
            const match = file.match(/^([^_]+)/);
            const prefix = match ? match[1] : null;
            if (prefix) {
                if (!localGroups[prefix]) {
                    localGroups[prefix] = [];
                }
                localGroups[prefix].push(file);
            }
        });

        // Sort files alphabetically in each group
        Object.keys(localGroups).forEach(prefix => {
            localGroups[prefix].sort();
        });

        const targetFile = '20260622_create_daraz_review_tables.sql';
        
        console.log("1. Moving non-applied local migration files to backup...");
        let movedCount = 0;
        
        Object.keys(localGroups).forEach(prefix => {
            const filesInGroup = localGroups[prefix];
            const appliedCount = remoteAppliedCounts[prefix] || 0;
            
            filesInGroup.forEach((file, index) => {
                if (file === targetFile) {
                    // Always keep target file
                    return;
                }
                // Keep the first 'appliedCount' files, back up the rest
                if (index >= appliedCount) {
                    const src = path.join(migrationsDir, file);
                    const dest = path.join(backupDir, file);
                    fs.renameSync(src, dest);
                    movedCount++;
                }
            });
        });
        
        console.log(`Moved ${movedCount} unapplied files to backup.`);

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

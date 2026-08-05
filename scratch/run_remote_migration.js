const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const migrationsDir = path.resolve(__dirname, '../supabase/migrations');
const backupDir = path.resolve(__dirname, '../supabase/migrations_backup');

// The list of files that exist locally but are NOT recorded in the remote database's history table
const filesToBackup = [
    '20250109_create_mobile_captures.sql',
    '20250109_fix_storage_public_read.sql',
    '20250109_fix_storage_rls.sql',
    '20260114161500_add_courier_to_marketplace_orders.sql',
    '20260114182000_fix_marketplace_branch_fk.sql',
    '20260114205500_fix_marketplace_status_constraint.sql',
    '20260115_add_redirect_features.sql',
    '20260119_add_daraz_audit_columns.sql',
    '20260119_update_daraz_view_with_audit.sql',
    '20260120_add_item_status.sql',
    '20260121_add_delivered_by_daraz.sql',
    '20260121_refresh_daraz_view.sql',
    '20260204_add_confirmed_order_status.sql',
    '20260204_add_messaging_app_fields.sql',
    '20260205_add_performance_indexes.sql',
    '20260205_optimize_business_logic.sql',
    '20260205_optimize_daraz_orders_view.sql',
    '20260205_optimize_inventory_views.sql',
    '20260205_optimize_marketplace_orders.sql',
    '20260423_add_returned_delivered_audit.sql',
    '20260426_permission_system_upgrade.sql',
    '20260501_seed_all_permissions.sql',
    '20260510_create_daraz_order_reports.sql',
    '20260510_fix_stats_overloading_and_timeout.sql',
    '20260522_update_stock_ledger_view.sql',
    '20260609_create_damage_resolutions.sql',
    '20260609_update_stock_ledger_net_damage.sql',
    '20260611_update_purchase_plans_status_constraint.sql',
    '20260612_create_daraz_chat_tables.sql'
];

async function run() {
    try {
        // Create backup directory
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        console.log("1. Moving non-history local migration files to backup...");
        let movedCount = 0;
        filesToBackup.forEach(file => {
            const src = path.join(migrationsDir, file);
            const dest = path.join(backupDir, file);
            if (fs.existsSync(src)) {
                fs.renameSync(src, dest);
                movedCount++;
            }
        });
        console.log(`Moved ${movedCount} files to backup.`);

        console.log("2. Running 'supabase db push' to apply the new migration (20260616)...");
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
        let restoredCount = 0;
        filesToBackup.forEach(file => {
            const src = path.join(backupDir, file);
            const dest = path.join(migrationsDir, file);
            if (fs.existsSync(src)) {
                fs.renameSync(src, dest);
                restoredCount++;
            }
        });
        console.log(`Restored ${restoredCount} files.`);

        // Clean up backup directory
        if (fs.existsSync(backupDir)) {
            fs.rmdirSync(backupDir);
            console.log("Backup directory cleaned up.");
        }
    }
}

run();

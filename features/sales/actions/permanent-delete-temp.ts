'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// 9. Permanently delete order from backup (admin only)
export async function permanentlyDeleteOrder(deletedOrderId: string) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return { success: false, error: 'Not authenticated' }
        }

        // Check if admin
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profile?.role !== 'admin') {
            return { success: false, error: 'Only admins can permanently delete orders' }
        }

        // Get the backup to find original order ID
        const { data: backup, error: fetchError } = await supabase
            .from('deleted_orders')
            .select('original_order_id')
            .eq('id', deletedOrderId)
            .single()

        if (fetchError || !backup) {
            return { success: false, error: 'Backup not found' }
        }

        // Permanently delete from deleted_orders backup
        const { error: deleteBackupError } = await supabase
            .from('deleted_orders')
            .delete()
            .eq('id', deletedOrderId)

        if (deleteBackupError) {
            console.error('Error deleting backup:', deleteBackupError)
            return { success: false, error: deleteBackupError.message }
        }

        // Also permanently delete from daraz_orders if still exists
        await supabase
            .from('daraz_orders')
            .delete()
            .eq('id', backup.original_order_id)

        revalidatePath('/dashboard/settings/restore-backup')

        return { success: true }
    } catch (error: any) {
        console.error('permanentlyDeleteOrder error:', error)
        return { success: false, error: error.message }
    }
}

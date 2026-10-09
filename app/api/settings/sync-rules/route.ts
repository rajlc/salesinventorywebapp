import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const supabase = await createAdminClient()

        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'daraz_sync_rules')
            .single()

        if (error && error.code !== 'PGRST116') { // PGRST116 = not found
            // If table doesn't exist, this will error. 
            // We can return default.
            console.error("Error fetching settings:", error)
        }

        const settings = data?.value || {}
        return NextResponse.json({
            cutoff_date: settings.cutoff_date ?? null,
            product_cutoff_date: settings.product_cutoff_date ?? null,
            auto_add_purchase_list: settings.auto_add_purchase_list !== false, // Defaults to true
        })
    } catch (error) {
        return NextResponse.json({ 
            cutoff_date: null, 
            product_cutoff_date: null,
            auto_add_purchase_list: true 
        })
    }
}

export async function POST(request: Request) {
    try {
        const supabase = await createAdminClient()
        const body = await request.json()

        // Fetch current settings to avoid overwriting unrelated fields
        const { data: existingData } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'daraz_sync_rules')
            .maybeSingle()

        const currentValue = existingData?.value || {}
        const updatedValue = {
            ...currentValue,
            ...body,
            auto_add_purchase_list: body.auto_add_purchase_list !== false,
        }

        // Upsert setting
        const { error } = await supabase
            .from('app_settings')
            .upsert({
                key: 'daraz_sync_rules',
                value: updatedValue,
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' })

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error("Error saving settings:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

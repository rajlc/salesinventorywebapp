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

        return NextResponse.json(data?.value || { cutoff_date: null, product_cutoff_date: null })
    } catch (error) {
        return NextResponse.json({ cutoff_date: null, product_cutoff_date: null })
    }
}

export async function POST(request: Request) {
    try {
        const supabase = await createAdminClient()
        const body = await request.json()

        // Upsert setting
        const { error } = await supabase
            .from('app_settings')
            .upsert({
                key: 'daraz_sync_rules',
                value: body,
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' })

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error("Error saving settings:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

import Module from 'module';
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Mock @/lib/supabase/server
const originalRequire = (Module.prototype as any).require;
(Module.prototype as any).require = function (id: string) {
    if (id === '@/lib/supabase/server' || id.endsWith('lib/supabase/server')) {
        return {
            createClient: async () => supabaseAdmin,
            createAdminClient: async () => supabaseAdmin
        };
    }
    return originalRequire.apply(this, arguments);
};

async function run() {
    // Dynamic import to avoid hoisting issues
    const { getDarazAvgPrices } = await import('../features/sales/actions/avg-price-actions')

    console.log('Running getDarazAvgPrices(60) with mocked supabase/server...')
    const result = await getDarazAvgPrices(60)
    console.log('Total products returned:', result.length)

    const targets = [
        { name: 'EMS Neck', keyword: 'Neck' },
        { name: 'Personal Weighing', keyword: 'Personal' },
        { name: 'Bluetooth Weighing', keyword: 'Bluetooth' }
    ]

    targets.forEach(t => {
        const item = result.find(r => r.product_name?.includes(t.keyword))
        console.log(`\n${t.name} details:`)
        console.log(JSON.stringify(item ? {
            product_id: item.product_id,
            product_name: item.product_name,
            commission_percent: item.commission_percent,
            is_default_commission: item.is_default_commission,
            sold_qty: item.sold_qty
        } : null, null, 2))
    })
}

run().catch(console.error)

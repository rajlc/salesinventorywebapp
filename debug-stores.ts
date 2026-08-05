import { createClient } from '@/lib/supabase/server'

export async function checkOnlineStores() {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('online_stores')
        .select('*')

    if (error) {
        console.error('Error fetching online stores:', error)
        return
    }

    console.log('Online Stores in DB:')
    data?.forEach(store => {
        console.log(`- ID: ${store.id}, Account: ${store.seller_account}, SellerID: "${store.seller_id}"`)
    })
}

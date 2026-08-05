const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')
const axios = require('axios')
require('dotenv').config({ path: '.env.local' })

// Sign Daraz API Requests helper
function signRequest(apiName, params, appSecret) {
    const keys = Object.keys(params).sort()
    let str = apiName
    keys.forEach(key => {
        str += key + String(params[key])
    })
    return crypto.createHmac('sha256', appSecret).update(str).digest('hex').toUpperCase()
}

async function testSync() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Get the store token for app_type = 'chat'
    // Let's first query all connected stores to find store_id
    const { data: stores, error: storeErr } = await supabase
        .from('online_stores')
        .select('id, company_name, seller_account')
    
    if (storeErr || !stores || stores.length === 0) {
        console.error('No stores found in DB:', storeErr)
        return
    }

    console.log('Stores in database:')
    console.table(stores)

    // Find token for each store
    for (const store of stores) {
        console.log(`\nChecking tokens for store: ${store.company_name} (${store.id})`)
        const { data: tokenData, error: tokenError } = await supabase
            .from('daraz_api_tokens')
            .select('*')
            .eq('store_id', store.id)
            .eq('app_type', 'chat')
            .maybeSingle()

        if (tokenError || !tokenData) {
            console.log(`No chat token found for store: ${store.company_name}`)
            continue
        }

        console.log(`Found chat token. Expiry: ${tokenData.expires_in}, Account: ${tokenData.account}`)

        const appKey = process.env.NEXT_PUBLIC_DARAZ_CHAT_APP_KEY?.trim()
        const appSecret = process.env.DARAZ_CHAT_APP_SECRET?.trim()
        const API_URL = process.env.DARAZ_API_URL?.trim() || 'https://api.daraz.com.np/rest'

        if (!appKey || !appSecret) {
            console.error('App key or secret missing in env!')
            return
        }

        const timestamp = Date.now().toString()
        const params = {
            app_key: appKey,
            access_token: tokenData.access_token,
            timestamp,
            sign_method: 'sha256',
            start_time: Date.now().toString(), // current time
            page_size: '50'
        }

        const apiPath = '/im/session/list'
        params.sign = signRequest(apiPath, params, appSecret)

        console.log(`Sending API Request to: ${API_URL}${apiPath}`)
        console.log('Parameters:', params)

        try {
            const response = await axios.get(`${API_URL}${apiPath}`, { params })
            console.log('API Response status:', response.status)
            console.log('API Response data:')
            console.log(JSON.stringify(response.data, null, 2))
        } catch (err) {
            console.error('API request failed:', err.message)
            if (err.response) {
                console.error('Error response body:', err.response.data)
            }
        }
    }
}

testSync()

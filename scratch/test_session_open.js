const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')
const axios = require('axios')
require('dotenv').config({ path: '.env.local' })

function signRequest(apiName, params, appSecret) {
    const keys = Object.keys(params).sort()
    let str = apiName
    keys.forEach(key => {
        str += key + String(params[key])
    })
    return crypto.createHmac('sha256', appSecret).update(str).digest('hex').toUpperCase()
}

async function run() {
    const orderId = '215814324047048'
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get the store token for app_type = 'chat'
    const { data: tokenData, error: tokenError } = await supabase
        .from('daraz_api_tokens')
        .select('*')
        .eq('app_type', 'chat')
        .limit(1)
        .single()

    if (tokenError || !tokenData) {
        console.error('No chat token found in DB:', tokenError)
        return
    }

    const appKey = process.env.NEXT_PUBLIC_DARAZ_CHAT_APP_KEY?.trim()
    const appSecret = process.env.DARAZ_CHAT_APP_SECRET?.trim()
    const API_URL = process.env.DARAZ_API_URL?.trim() || 'https://api.daraz.com.np/rest'

    console.log(`Using App Key: ${appKey}`)
    console.log(`Using Store: ${tokenData.store_id} (${tokenData.account})`)

    const timestamp = Date.now().toString()
    const params = {
        app_key: appKey,
        access_token: tokenData.access_token,
        timestamp,
        sign_method: 'sha256',
        order_id: String(orderId)
    }

    const apiPath = '/im/session/open'
    params.sign = signRequest(apiPath, params, appSecret)

    console.log(`Calling API: ${API_URL}${apiPath}`)
    console.log('Params:', params)

    try {
        const response = await axios.post(`${API_URL}${apiPath}`, null, { params })
        console.log('Response code:', response.status)
        console.log('Response body:', JSON.stringify(response.data, null, 2))
    } catch (err) {
        console.error('Request failed:', err.message)
        if (err.response) {
            console.error('Response error body:', err.response.data)
        }
    }
}

run()

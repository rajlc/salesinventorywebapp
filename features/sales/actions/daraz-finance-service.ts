'use server'

import crypto from 'crypto'
import axios from 'axios'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Helper to sign extraction requests
function signRequest(apiName: string, params: Record<string, any>, appSecret: string) {
    const keys = Object.keys(params).sort()
    let str = apiName
    keys.forEach(key => {
        str += key + params[key]
    })
    return crypto.createHmac('sha256', appSecret).update(str).digest('hex').toUpperCase()
}

// 1. Existing function for Order-Specific sync (Profit Tracker usage)
export async function fetchDarazFinanceTransactions(orderId: string, storeId: string, orderDate?: string) {
    const supabase = await createAdminClient()

    const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY
    const appSecret = process.env.DARAZ_APP_SECRET
    const apiUrl = process.env.DARAZ_API_URL || 'https://api.daraz.com.np/rest'

    if (!appKey || !appSecret) {
        throw new Error('Daraz API configuration missing')
    }

    // 1. Get Token
    const { data: tokenData, error: dbError } = await supabase
        .from('daraz_api_tokens')
        .select('*')
        .eq('store_id', storeId)
        .eq('app_type', 'order')
        .maybeSingle()

    if (dbError || !tokenData) {
        throw new Error('No active connection/token found for this store. Please connect your Daraz account for Orders.')
    }

    let startTime = new Date()
    if (orderDate) {
        startTime = new Date(orderDate)
    } else {
        startTime.setDate(startTime.getDate() - 60) // Look back 60 days by default
    }

    const endTime = new Date() // Now

    // Limit check
    const diffTime = Math.abs(endTime.getTime() - startTime.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 150) {
        startTime = new Date()
        startTime.setDate(startTime.getDate() - 140)
    }

    const apiPath = '/finance/transaction/details/get'

    // CRITICAL FIX: Use pagination to fetch ALL transactions for this order
    let allTransactions: any[] = []
    let offset = 0
    const limit = 500 // Max limit per docs
    let hasMore = true
    let loopCount = 0

    try {
        while (hasMore && loopCount < 20) { // Safety break at 10k transactions per order
            const params: Record<string, any> = {
                app_key: appKey,
                access_token: tokenData.access_token,
                timestamp: new Date().getTime(),
                sign_method: 'sha256',
                trade_order_id: orderId,
                start_time: startTime.toISOString().split('T')[0],
                end_time: endTime.toISOString().split('T')[0],
                trans_type: -1,
                limit: limit,
                offset: offset
            }

            params.sign = signRequest(apiPath, params, appSecret)

            const response = await axios.get(`${apiUrl}${apiPath}`, { params })

            if ((response.data.code !== "0" && response.data.code !== 0) || !response.data.data) {
                // If first page returns no data, return empty array
                if (offset === 0) {
                    return []
                }
                // If subsequent pages fail, break and return what we have
                break
            }

            const pageData = response.data.data || []

            if (pageData.length > 0) {
                allTransactions = [...allTransactions, ...pageData]

                // If we got less than requested, we are done
                if (pageData.length < limit) {
                    hasMore = false
                } else {
                    offset += pageData.length // Move offset by actual amount received
                }
            } else {
                hasMore = false
            }

            loopCount++
        }

        console.log(`[Daraz Finance Order] Fetched ${allTransactions.length} transactions for Order ${orderId}`)
        return allTransactions

    } catch (error: any) {
        console.error('Finance API Fetch Error:', error.response?.data || error.message)
        throw new Error('Failed to fetch finance from Daraz API')
    }
}

// 2. NEW: Bulk Sync for Account Statement (Date Range based)
export async function syncDarazFinances(storeId: string, startDateStr: string, endDateStr: string) {
    const supabase = await createAdminClient()

    const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY
    const appSecret = process.env.DARAZ_APP_SECRET
    const apiUrl = process.env.DARAZ_API_URL || 'https://api.daraz.com.np/rest'

    if (!appKey || !appSecret) {
        throw new Error('Daraz API configuration missing')
    }

    // Get Token
    const { data: tokenData, error: dbError } = await supabase
        .from('daraz_api_tokens')
        .select('*')
        .eq('store_id', storeId)
        .eq('app_type', 'order')
        .maybeSingle()

    if (dbError || !tokenData) {
        throw new Error('No active connection/token found for this store. Please connect your Daraz account for Orders.')
    }

    const apiPath = '/finance/transaction/details/get'

    let allTransactions: any[] = []
    let offset = 0
    const limit = 500 // Max limit per docs
    let hasMore = true
    let loopCount = 0

    try {
        while (hasMore && loopCount < 100) { // Safety break at 50k transactions
            // Query Params
            const params: Record<string, any> = {
                app_key: appKey,
                access_token: tokenData.access_token,
                timestamp: new Date().getTime(),
                sign_method: 'sha256',
                start_time: startDateStr,
                end_time: endDateStr,
                trans_type: '-1', // Doc says String
                limit: limit,
                offset: offset
            }

            params.sign = signRequest(apiPath, params, appSecret)

            const response = await axios.get(`${apiUrl}${apiPath}`, { params })
            const apiData = response.data

            if ((apiData.code !== "0" && apiData.code !== 0)) {
                throw new Error(`Daraz API Error: ${JSON.stringify(apiData)}`)
            }

            const pageData = apiData.data || []

            if (pageData.length > 0) {
                allTransactions = [...allTransactions, ...pageData]

                // If we got less than requested, we are done
                if (pageData.length < limit) {
                    hasMore = false
                } else {
                    offset += pageData.length // Move offset by actual amount received
                }
            } else {
                hasMore = false
            }
            loopCount++
        }

        console.log(`[Daraz Finance] Fetched TOTAL ${allTransactions.length} transactions for Store ${storeId} (${startDateStr} to ${endDateStr})`)

        if (allTransactions.length === 0) {
            return { count: 0, message: 'No transactions found in this period' }
        }

        // Prepare for DB Upsert
        const rows = allTransactions.map((t: any) => ({
            transaction_number: String(t.transaction_number),
            store_id: storeId,
            transaction_type: t.transaction_type,
            fee_name: t.fee_name,
            amount: parseFloat(t.amount || 0),
            vat_amount: parseFloat(t.vat_amount || 0),
            wht_amount: parseFloat(t.wht_amount || 0),
            statement: t.statement || null,
            transaction_date: t.transaction_date,
            order_no: t.order_no || null,
            details: t,
            created_at: new Date().toISOString()
        }))

        // Deduplicate rows based on transaction_number
        const uniqueRowsMap = new Map()
        rows.forEach((row: any) => {
            uniqueRowsMap.set(row.transaction_number, row)
        })
        const uniqueRows = Array.from(uniqueRowsMap.values())

        if (uniqueRows.length === 0) {
            return { count: 0, message: 'No new unique transactions to sync' }
        }

        // Upsert to Supabase in chunks (Supabase limit is usually huge but better safe)
        // 5000 is safe
        const { error: upsertError } = await supabase
            .from('daraz_finance_transactions')
            .upsert(uniqueRows, { onConflict: 'transaction_number' })

        if (upsertError) {
            console.error('DB Upsert Error:', upsertError)
            throw new Error('Failed to save transactions to database')
        }

        revalidatePath('/dashboard/account/daraz-account')
        return { count: uniqueRows.length, message: `Successfully synced ${uniqueRows.length} transactions` }

    } catch (error: any) {
        console.error('Finance Link Error:', error.response?.data || error.message)
        throw new Error(error.message || 'Failed to sync finance data')
    }
}

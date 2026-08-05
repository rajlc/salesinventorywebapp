const fs = require('fs');
const file = 'features/sales/actions/avg-price-actions.ts';
let content = fs.readFileSync(file, 'utf8');

const newAction = `

/**
 * Push the Daraz Price (market_price) for one product to Daraz as a special price.
 * Special price date range: today -> 4 years from today.
 */
export async function pushPriceToDaraz(productId: string) {
    try {
        const supabase = await createClient()
        const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY
        const appSecret = process.env.DARAZ_APP_SECRET
        const apiUrl = process.env.DARAZ_API_URL || 'https://api.daraz.com.np/rest'

        if (!appKey || !appSecret) throw new Error('Missing Daraz API credentials')

        const { data: skuRow, error: skuErr } = await supabase
            .from('products')
            .select('seller_sku1, seller_sku2, seller_sku3, seller_sku4')
            .eq('id', productId)
            .single()

        if (skuErr || !skuRow) throw new Error('Product not found')

        const productSkus = [skuRow.seller_sku1, skuRow.seller_sku2, skuRow.seller_sku3, skuRow.seller_sku4].filter(Boolean) as string[]
        if (productSkus.length === 0) throw new Error('Product has no seller SKUs configured')

        const { data: priceRow } = await supabase
            .from('daraz_avg_prices')
            .select('market_price')
            .eq('product_id', productId)
            .single()

        const marketPrice = priceRow?.market_price
        if (!marketPrice || marketPrice <= 0) throw new Error('Daraz Price is 0 or not set - enter a price first')

        const { data: tokens, error: tokensErr } = await supabase.from('daraz_api_tokens').select('*')
        if (tokensErr || !tokens || tokens.length === 0) throw new Error('No connected seller stores found')

        const { data: livePrices } = await supabase
            .from('daraz_live_prices')
            .select('seller_sku, store_id')
            .in('seller_sku', productSkus)

        const storeSkuMap = new Map<string, string[]>()
        if (livePrices && livePrices.length > 0) {
            for (const lp of livePrices) {
                if (!storeSkuMap.has(lp.store_id)) storeSkuMap.set(lp.store_id, [])
                storeSkuMap.get(lp.store_id)!.push(lp.seller_sku)
            }
        } else {
            for (const token of tokens) {
                storeSkuMap.set(token.store_id, productSkus)
            }
        }

        const now = new Date()
        const pad = (n: number) => String(n).padStart(2, '0')
        const fmt = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate())
        const startDate = fmt(now)
        const endDate = fmt(new Date(now.getFullYear() + 4, now.getMonth(), now.getDate()))

        const results: { store: string; skus: string[]; success: boolean; message: string }[] = []

        for (const token of tokens) {
            const skusForStore = storeSkuMap.get(token.store_id)
            if (!skusForStore || skusForStore.length === 0) continue

            const storeName = STORE_NAME_MAP[token.account] || token.account

            const skuXml = skusForStore.map(sku =>
                '<Sku><SellerSku><![CDATA[' + sku + ']]></SellerSku><PriceDiscount>' +
                '<start_datetime>' + startDate + ' 00:00:00</start_datetime>' +
                '<end_datetime>' + endDate + ' 23:59:59</end_datetime>' +
                '<special_price>' + marketPrice + '</special_price>' +
                '</PriceDiscount></Sku>'
            ).join('')

            const xmlPayload = '<Request><Product><Skus>' + skuXml + '</Skus></Product></Request>'

            const apiPath = '/product/price/update'
            const callParams: Record<string, any> = {
                app_key: appKey,
                access_token: token.access_token,
                timestamp: String(new Date().getTime()),
                sign_method: 'sha256',
                payload: xmlPayload
            }
            const sortedKeys = Object.keys(callParams).sort()
            let signStr = apiPath
            sortedKeys.forEach(k => { signStr += k + callParams[k] })
            callParams.sign = crypto.createHmac('sha256', appSecret).update(signStr).digest('hex').toUpperCase()

            try {
                const res = await axios.post(apiUrl + apiPath, null, { params: callParams })
                const code = String(res.data?.code)
                if (code === '0') {
                    results.push({ store: storeName, skus: skusForStore, success: true, message: 'Price pushed' })
                } else {
                    results.push({ store: storeName, skus: skusForStore, success: false, message: res.data?.message || 'API error code ' + code })
                }
            } catch (err: any) {
                results.push({ store: storeName, skus: skusForStore, success: false, message: err?.response?.data?.message || err.message })
            }
        }

        const anySuccess = results.some(r => r.success)
        const summary = results.map(r => r.store + ': ' + r.message).join(' | ')

        return { success: anySuccess, message: summary, results }

    } catch (error: any) {
        console.error('pushPriceToDaraz Error:', error)
        return { success: false, message: error.message || 'Unknown error' }
    }
}
`;

content = content.trimEnd() + '\n' + newAction + '\n';
fs.writeFileSync(file, content);
console.log('Added pushPriceToDaraz action.');

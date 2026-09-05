'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { getStatementBreakdown, extractTaxInvoicesFromBreakdown } from '@/features/sales/utils/daraz-statement-calculator'

export interface DarazTaxInvoiceRecord {
    id: string
    statement_number?: string | null
    date: string
    date_period: string
    store_name: string
    company_name: string
    invoice_number?: string | null
    description: string
    taxable_amount: number
    vat_amount: number
    grand_total: number
    is_verified: boolean
    verified_at?: string | null
    source: 'auto' | 'manual'
    notes?: string | null
    fiscal_year_id?: string | null
    created_at?: string
    updated_at?: string
}

export interface GetDarazTaxInvoicesParams {
    fiscalYearId?: string
    startDate?: string
    endDate?: string
    companyName?: string
    storeName?: string
    verificationStatus?: 'all' | 'verified' | 'unverified'
}


/**
 * Fetch live statement tax invoices from database / API
 */
export async function getLiveDarazStatementTaxMap(statements?: Array<{
    statementNumber?: string
    storeId?: string
    period?: string
    itemRevenue?: number
    storeName?: string
}>): Promise<Record<string, Array<{
    desc: string
    net: number
    taxableAmt: number
    vatAmt: number
    grandTotal: number
}>>> {
    try {
        const supabase = await createAdminClient()

        const { data: storeRows } = await supabase
            .from('online_stores')
            .select('id, seller_account, seller_id, company_name')

        const storeNameMap: Record<string, string> = {}
        storeRows?.forEach((s: any) => {
            if (s.id && s.seller_account) {
                storeNameMap[s.id] = s.seller_account
            }
        })

        const stmtNumbers = Array.from(new Set((statements || [])
            .map(s => s.statementNumber?.trim())
            .filter(Boolean) as string[]))

        const periods = Array.from(new Set((statements || [])
            .map(s => s.period?.trim())
            .filter(Boolean) as string[]))

        const searchTokens = Array.from(new Set([...stmtNumbers, ...periods]))

        // Fetch transactions from daraz_finance_transactions fast in batches
        let allTx: any[] = []
        if (searchTokens.length > 0) {
            const batchSize = 60
            for (let i = 0; i < searchTokens.length; i += batchSize) {
                const batch = searchTokens.slice(i, i + batchSize)
                const { data: chunk, error } = await supabase
                    .from('daraz_finance_transactions')
                    .select('statement, store_id, fee_name, transaction_type, amount, transaction_date')
                    .in('statement', batch)
                if (!error && chunk) {
                    allTx.push(...chunk)
                }
            }
        }

        // Group DB transactions by statement & store
        const groupedByStatement: Record<string, Record<string, number>> = {}

        allTx.forEach(tx => {
            const stmt = tx.statement?.trim() || ''
            if (!stmt) return

            const store = storeNameMap[tx.store_id] || ''
            const key1 = stmt.toLowerCase()
            const key2 = `${stmt.toLowerCase()}_${store.toLowerCase()}`

            const feeName = (tx.fee_name || '').trim().toLowerCase()
            const amount = typeof tx.amount === 'number' ? tx.amount : parseFloat(String(tx.amount || 0)) || 0

            for (const key of [key1, key2]) {
                if (!groupedByStatement[key]) groupedByStatement[key] = {}
                groupedByStatement[key][feeName] = (groupedByStatement[key][feeName] || 0) + amount
            }
        })

        const getFee = (group: Record<string, number>, searchName: string) => {
            const q = searchName.toLowerCase().trim()
            // 1. Exact match
            if (group[q] !== undefined) {
                return Math.abs(group[q])
            }
            // 2. Partial match
            for (const [k, v] of Object.entries(group)) {
                if (k.toLowerCase().includes(q)) return Math.abs(v)
            }
            return 0
        }

        const resultMap: Record<string, Array<{ desc: string; net: number; taxableAmt: number; vatAmt: number; grandTotal: number }>> = {}

        // 1. Process statements that have DB transactions
        for (const [key, group] of Object.entries(groupedByStatement)) {
            const voucherCharge = getFee(group, 'co-funded voucher max')
            const voucherRefund = getFee(group, 'co-funded voucher max reversal')
            const voucherNet = Math.max(0, Math.round((voucherCharge - voucherRefund) * 100) / 100)

            const paymentCharge = getFee(group, 'payment fee')
            const paymentRefund = getFee(group, 'payment fee refunded')
            const paymentNet = Math.max(0, Math.round((paymentCharge - paymentRefund) * 100) / 100)

            const commCharge = getFee(group, 'commission fee')
            const commRefund = getFee(group, 'commission fee refunded')
            const commNet = Math.max(0, Math.round((commCharge - commRefund) * 100) / 100)

            const freeShipCharge = getFee(group, 'free shipping max fee')
            const freeShipRefund = getFee(group, 'reversal of free shipping max fee')
            const freeShipNet = Math.max(0, Math.round((freeShipCharge - freeShipRefund) * 100) / 100)

            const coinsCharge = getFee(group, 'daraz coins discount participation fee')
            const coinsRefund = getFee(group, 'reversal of daraz coins discount participation fee')
            const coinsNet = Math.max(0, Math.round((coinsCharge - coinsRefund) * 100) / 100)

            const handlingCharge = getFee(group, 'handling fee')
            const returnHandling = getFee(group, 'handling fee for return')
            const handlingNet = Math.max(0, Math.round((handlingCharge + returnHandling) * 100) / 100)

            const isBagmati = key.toLowerCase().includes('bagmati') || key.toLowerCase().includes('npdznlue6t')

            const merchantCharge = isBagmati ? getFee(group, 'merchant managed services charge') : 0
            const merchantNet = isBagmati ? Math.max(0, Math.round(merchantCharge * 100) / 100) : 0

            const rawItems = [
                { desc: 'Tax Invoice - Co Funded Voucher Max', net: voucherNet },
                { desc: 'Tax Invoice - Payment Fee', net: paymentNet },
                { desc: 'Tax Invoice - Commission Fee', net: commNet },
                { desc: 'Tax Invoice - Free Shipping Max', net: freeShipNet },
                { desc: 'Tax Invoice - Daraz Coins Discount Participation Fee', net: coinsNet },
                { desc: 'Tax Invoice - Handling Fee', net: handlingNet },
                ...(isBagmati && merchantNet > 0 ? [{ desc: 'Tax Invoice - Merchant Managed Services Charge', net: merchantNet }] : [])
            ]

            resultMap[key] = rawItems
                .filter(t => t.net > 0)
                .map(t => {
                    const taxableAmt = Math.round((t.net / 1.13) * 100) / 100
                    const vatAmt = Math.round((taxableAmt * 0.13) * 100) / 100
                    const grandTotal = Math.round((taxableAmt + vatAmt) * 100) / 100
                    return {
                        desc: t.desc,
                        net: t.net,
                        taxableAmt,
                        vatAmt,
                        grandTotal
                    }
                })
        }

        // 2. Ensure ALL requested statements are populated with exact calculated tax invoices
        (statements || []).forEach(stmt => {
            const stmtNo = (stmt.statementNumber || '').trim().toLowerCase()
            const periodStr = (stmt.period || '').trim().toLowerCase()
            const rawStore = (stmt.storeName || '').trim().toLowerCase()
            const isBagmati = rawStore.includes('bagmati') || stmtNo.includes('npdznlue6t')

            const key1 = stmtNo
            const key2 = `${stmtNo}_${rawStore}`
            const key3 = periodStr
            const key4 = `${periodStr}_${rawStore}`

            const existing = (key2 && resultMap[key2]) || (key1 && resultMap[key1]) || (key4 && resultMap[key4]) || (key3 && resultMap[key3])

            if (existing && existing.length > 0) {
                // Ensure all aliases have the record
                if (key1) resultMap[key1] = existing
                if (key2) resultMap[key2] = existing
                if (key3) resultMap[key3] = existing
                if (key4) resultMap[key4] = existing
            } else {
                // Compute from statement breakdown
                const b = getStatementBreakdown({
                    statement_number: stmt.statementNumber,
                    statement: stmt.period,
                    created_at: stmt.period,
                    store_name: stmt.storeName,
                    item_revenue: stmt.itemRevenue
                })

                const taxItems = extractTaxInvoicesFromBreakdown(b, isBagmati)

                if (key1) resultMap[key1] = taxItems
                if (key2) resultMap[key2] = taxItems
                if (key3) resultMap[key3] = taxItems
                if (key4) resultMap[key4] = taxItems
            }
        })

        return resultMap
    } catch (err: any) {
        console.warn('getLiveDarazStatementTaxMap error:', err.message)
        return {}
    }
}

/**
 * Fetch stored Daraz tax invoices from database
 */
export async function getStoredDarazTaxInvoices(params: GetDarazTaxInvoicesParams = {}): Promise<DarazTaxInvoiceRecord[]> {
    try {
        const supabase = await createAdminClient()

        let query = supabase
            .from('daraz_tax_invoices')
            .select('*')
            .order('date', { ascending: false })
            .order('created_at', { ascending: false })

        if (params.fiscalYearId && params.fiscalYearId !== 'all') {
            // Only filter by fiscal_year_id when there is no date range.
            // When startDate+endDate are provided, date-range filtering is sufficient
            // and avoids excluding records that have fiscal_year_id = null
            // (e.g., auto-synced records from Statement Overview).
            if (!params.startDate && !params.endDate) {
                query = query.eq('fiscal_year_id', params.fiscalYearId)
            }
        }

        if (params.startDate) {
            query = query.gte('date', params.startDate)
        }

        if (params.endDate) {
            query = query.lte('date', params.endDate)
        }

        if (params.storeName && params.storeName !== 'all') {
            query = query.ilike('store_name', `%${params.storeName}%`)
        }

        if (params.companyName && params.companyName !== 'all') {
            query = query.ilike('company_name', `%${params.companyName}%`)
        }

        if (params.verificationStatus === 'verified') {
            query = query.eq('is_verified', true)
        } else if (params.verificationStatus === 'unverified') {
            query = query.eq('is_verified', false)
        }

        const { data, error } = await query

        if (error) {
            // If table doesn't exist yet, return empty list gracefully
            console.warn('[Daraz Tax Invoices] DB fetch warning (using fallback if unmigrated):', error.message)
            return []
        }

        return (data || []).map((row: any) => ({
            ...row,
            taxable_amount: parseFloat(row.taxable_amount) || 0,
            vat_amount: parseFloat(row.vat_amount) || 0,
            grand_total: parseFloat(row.grand_total) || 0,
            is_verified: !!row.is_verified
        }))
    } catch (err: any) {
        console.error('[Daraz Tax Invoices] Fetch error:', err.message)
        return []
    }
}

/**
 * Create a new Manual Tax Invoice
 */
export async function createDarazTaxInvoice(data: {
    date: string
    date_period: string
    store_name: string
    company_name: string
    invoice_number?: string
    description: string
    taxable_amount: number
    vat_amount: number
    grand_total: number
    is_verified?: boolean
    notes?: string
    fiscal_year_id?: string
}) {
    try {
        const supabase = await createAdminClient()

        const isVerified = !!data.is_verified
        const verifiedAt = isVerified ? new Date().toISOString() : null

        const { data: inserted, error } = await supabase
            .from('daraz_tax_invoices')
            .insert({
                date: data.date,
                date_period: data.date_period,
                store_name: data.store_name,
                company_name: data.company_name,
                invoice_number: data.invoice_number?.trim() || null,
                description: data.description.trim(),
                taxable_amount: data.taxable_amount,
                vat_amount: data.vat_amount,
                grand_total: data.grand_total,
                is_verified: isVerified,
                verified_at: verifiedAt,
                source: 'manual',
                notes: data.notes?.trim() || null,
                fiscal_year_id: data.fiscal_year_id || null
            })
            .select()
            .single()

        if (error) {
            console.error('[Daraz Tax Invoices] Insert error:', error)
            throw new Error(`Failed to create tax invoice: ${error.message}`)
        }

        return { success: true, data: inserted }
    } catch (err: any) {
        console.error('createDarazTaxInvoice error:', err)
        throw err
    }
}

/**
 * Toggle or update verification status on a Tax Invoice
 */
export async function updateDarazTaxInvoiceVerification(id: string, isVerified: boolean) {
    try {
        const supabase = await createAdminClient()

        const verifiedAt = isVerified ? new Date().toISOString() : null

        const { error } = await supabase
            .from('daraz_tax_invoices')
            .update({
                is_verified: isVerified,
                verified_at: verifiedAt,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)

        if (error) {
            console.error('[Daraz Tax Invoices] Verification update error:', error)
            throw new Error(`Failed to update verification: ${error.message}`)
        }

        return { success: true }
    } catch (err: any) {
        console.error('updateDarazTaxInvoiceVerification error:', err)
        throw err
    }
}

/**
 * Delete a manual Tax Invoice
 */
export async function deleteDarazTaxInvoice(id: string) {
    try {
        const supabase = await createAdminClient()

        const { error } = await supabase
            .from('daraz_tax_invoices')
            .delete()
            .eq('id', id)

        if (error) {
            console.error('[Daraz Tax Invoices] Delete error:', error)
            throw new Error(`Failed to delete invoice: ${error.message}`)
        }

        return { success: true }
    } catch (err: any) {
        console.error('deleteDarazTaxInvoice error:', err)
        throw err
    }
}

/**
 * Save or update a Daraz Tax Invoice with edit support and locking
 */
export async function saveOrUpdateDarazTaxInvoice(data: {
    id?: string
    statement_number?: string | null
    date: string
    date_period: string
    store_name: string
    company_name: string
    invoice_number?: string | null
    description: string
    taxable_amount: number
    vat_amount: number
    grand_total: number
    is_verified: boolean
    notes?: string | null
    fiscal_year_id?: string | null
}) {
    try {
        const supabase = await createAdminClient()
        const isVerified = !!data.is_verified
        const verifiedAt = isVerified ? new Date().toISOString() : null
        const now = new Date().toISOString()

        if (data.id) {
            // Fast path: update by known PK — no select needed
            const { error } = await supabase
                .from('daraz_tax_invoices')
                .update({
                    date: data.date,
                    date_period: data.date_period,
                    store_name: data.store_name,
                    company_name: data.company_name,
                    invoice_number: data.invoice_number?.trim() || null,
                    description: data.description.trim(),
                    taxable_amount: data.taxable_amount,
                    vat_amount: data.vat_amount,
                    grand_total: data.grand_total,
                    is_verified: isVerified,
                    verified_at: verifiedAt,
                    notes: data.notes?.trim() || null,
                    fiscal_year_id: data.fiscal_year_id || null,
                    updated_at: now
                })
                .eq('id', data.id)

            if (error) {
                console.error('[Daraz Tax Invoices] Update error:', error)
                throw new Error(`Failed to update tax invoice: ${error.message}`)
            }
            return { success: true }
        }

        // No id — use upsert via the unique index (statement_number, store_name, description)
        // This is a single round-trip instead of lookup + separate update.
        const { error } = await supabase
            .from('daraz_tax_invoices')
            .upsert(
                {
                    statement_number: data.statement_number || null,
                    date: data.date,
                    date_period: data.date_period,
                    store_name: data.store_name,
                    company_name: data.company_name,
                    invoice_number: data.invoice_number?.trim() || null,
                    description: data.description.trim(),
                    taxable_amount: data.taxable_amount,
                    vat_amount: data.vat_amount,
                    grand_total: data.grand_total,
                    is_verified: isVerified,
                    verified_at: verifiedAt,
                    source: data.statement_number ? 'auto' : 'manual',
                    notes: data.notes?.trim() || null,
                    fiscal_year_id: data.fiscal_year_id || null,
                    updated_at: now
                },
                {
                    onConflict: 'statement_number,store_name,description',
                    ignoreDuplicates: false
                }
            )

        if (error) {
            console.error('[Daraz Tax Invoices] Upsert error:', error)
            throw new Error(`Failed to save tax invoice: ${error.message}`)
        }

        return { success: true }
    } catch (err: any) {
        console.error('saveOrUpdateDarazTaxInvoice error:', err)
        throw err
    }
}

/**
 * Sync auto-calculated statement tax invoices into database.
 * Uses DELETE + INSERT instead of upsert-on-partial-index because Supabase
 * cannot resolve partial unique indexes in onConflict. Verified records are
 * never touched.
 */
export async function syncStatementTaxInvoicesToDB(invoices: Array<{
    statement_number?: string
    date: string
    date_period: string
    store_name: string
    company_name: string
    description: string
    taxable_amount: number
    vat_amount: number
    grand_total: number
    fiscal_year_id?: string
}>) {
    try {
        if (!invoices || invoices.length === 0) return { success: true, count: 0 }

        const supabase = await createAdminClient()

        // Prune incorrect auto MMS invoices for non-Bagmati stores
        await supabase
            .from('daraz_tax_invoices')
            .delete()
            .eq('source', 'auto')
            .ilike('description', '%merchant managed%')
            .not('store_name', 'ilike', '%bagmati%')

        // Fetch verified record keys so we don't overwrite them
        const statementNumbers = Array.from(new Set(invoices.map(i => i.statement_number).filter(Boolean))) as string[]
        const verifiedKeys = new Set<string>()

        if (statementNumbers.length > 0) {
            const { data: verifiedRows } = await supabase
                .from('daraz_tax_invoices')
                .select('statement_number, store_name, description')
                .in('statement_number', statementNumbers)
                .eq('source', 'auto')
                .eq('is_verified', true)

            verifiedRows?.forEach((r: any) => {
                verifiedKeys.add(`${r.statement_number}_${r.store_name}_${r.description}`)
            })
        }

        // Lookup fiscal year if not provided
        const { data: fyList } = await supabase
            .from('fiscal_years')
            .select('id, start_date, end_date')

        // Only process non-verified records
        const toInsert = invoices
            .filter(item => item.statement_number && !verifiedKeys.has(`${item.statement_number}_${item.store_name}_${item.description}`))
            .map(item => {
                let fyId = item.fiscal_year_id || null
                if (!fyId && fyList && item.date) {
                    const matchedFy = fyList.find(f => f.start_date <= item.date && f.end_date >= item.date)
                    if (matchedFy) fyId = matchedFy.id
                }
                return {
                    statement_number: item.statement_number!,
                    date: item.date,
                    date_period: item.date_period,
                    store_name: item.store_name,
                    company_name: item.company_name,
                    description: item.description,
                    taxable_amount: item.taxable_amount,
                    vat_amount: item.vat_amount,
                    grand_total: item.grand_total,
                    is_verified: false,
                    source: 'auto' as const,
                    fiscal_year_id: fyId,
                    updated_at: new Date().toISOString()
                }
            })

        if (toInsert.length === 0) return { success: true, count: 0 }

        // Group by statement_number to delete+insert per statement
        // This avoids the partial-index upsert limitation in Supabase
        const byStatement: Record<string, typeof toInsert> = {}
        toInsert.forEach(item => {
            const k = item.statement_number
            if (!byStatement[k]) byStatement[k] = []
            byStatement[k].push(item)
        })

        for (const [stmtNo, rows] of Object.entries(byStatement)) {
            // Get unique store names in this batch
            const storeNames = Array.from(new Set(rows.map(r => r.store_name)))

            for (const storeName of storeNames) {
                const storeRows = rows.filter(r => r.store_name === storeName)
                const descriptions = storeRows.map(r => r.description)

                // Delete existing unverified records for this statement+store+descriptions
                await supabase
                    .from('daraz_tax_invoices')
                    .delete()
                    .eq('statement_number', stmtNo)
                    .eq('store_name', storeName)
                    .eq('source', 'auto')
                    .eq('is_verified', false)
                    .in('description', descriptions)

                // Insert fresh records
                const { error } = await supabase
                    .from('daraz_tax_invoices')
                    .insert(storeRows)

                if (error) {
                    console.warn(`[Daraz Tax Invoices] Insert warning for ${stmtNo}/${storeName}:`, error.message)
                }
            }
        }

        return { success: true, count: toInsert.length }
    } catch (err: any) {
        console.warn('[Daraz Tax Invoices] Sync warning:', err.message)
        return { success: false, error: err.message }
    }
}

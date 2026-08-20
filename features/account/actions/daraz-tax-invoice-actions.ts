'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { format } from 'date-fns'

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

import { fetchStatementTaxInvoicesBatch } from '@/features/sales/actions/daraz-finance-service'

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
        if (statements && statements.length > 0) {
            const formatted = statements.map(s => ({
                statementNumber: s.statementNumber || '',
                storeId: s.storeId,
                period: s.period,
                itemRevenue: s.itemRevenue,
                storeName: s.storeName
            }))
            const batchMap = await fetchStatementTaxInvoicesBatch(formatted)
            if (Object.keys(batchMap).length > 0) {
                return batchMap
            }
        }

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

        // Fetch transactions from daraz_finance_transactions
        let allTx: any[] = []
        let from = 0
        const step = 1000
        while (true) {
            const { data: chunk, error } = await supabase
                .from('daraz_finance_transactions')
                .select('statement, store_id, fee_name, transaction_type, amount, transaction_date')
                .range(from, from + step - 1)

            if (error || !chunk || chunk.length === 0) break
            allTx.push(...chunk)
            if (chunk.length < step) break
            from += step
        }

        if (allTx.length === 0) return {}

        // Group by statement & store
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

            const coinsCharge = getFee(group, 'daraz coins discount participation fee')
            const coinsRefund = getFee(group, 'reversal of daraz coins discount participation fee')
            const coinsNet = Math.max(0, Math.round((coinsCharge - coinsRefund) * 100) / 100)

            const handlingCharge = getFee(group, 'handling fee')
            const returnHandling = getFee(group, 'handling fee for return')
            const handlingNet = Math.max(0, Math.round((handlingCharge + returnHandling) * 100) / 100)

            const isBagmati = key.toLowerCase().includes('bagmati') || (stmt.storeName && stmt.storeName.toLowerCase().includes('bagmati')) || (stmt.statementNumber && stmt.statementNumber.includes('NPDZNLUE6T'))

            const merchantCharge = isBagmati ? getFee(group, 'merchant managed services charge') : 0
            const merchantNet = isBagmati ? Math.max(0, Math.round(merchantCharge * 100) / 100) : 0

            const rawItems = [
                { desc: 'Tax Invoice - Co Funded Voucher Max', net: voucherNet },
                { desc: 'Tax Invoice - Payment Fee', net: paymentNet },
                { desc: 'Tax Invoice - Commission Fee', net: commNet },
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
            query = query.eq('fiscal_year_id', params.fiscalYearId)
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

        revalidatePath('/dashboard/account/pan-vat-billing/report')
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

        revalidatePath('/dashboard/account/pan-vat-billing/report')
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

        revalidatePath('/dashboard/account/pan-vat-billing/report')
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

        if (data.id) {
            // Update existing record
            const { data: updated, error } = await supabase
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
                    updated_at: new Date().toISOString()
                })
                .eq('id', data.id)
                .select()
                .single()

            if (error) {
                console.error('[Daraz Tax Invoices] Update error:', error)
                throw new Error(`Failed to update tax invoice: ${error.message}`)
            }
            revalidatePath('/dashboard/account/pan-vat-billing/report')
            return { success: true, data: updated }
        } else {
            // Check if existing auto record exists by statement_number, store_name, description
            if (data.statement_number) {
                const { data: existing } = await supabase
                    .from('daraz_tax_invoices')
                    .select('id')
                    .eq('statement_number', data.statement_number)
                    .eq('store_name', data.store_name)
                    .eq('description', data.description.trim())
                    .maybeSingle()

                if (existing) {
                    const { data: updated, error } = await supabase
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
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', existing.id)
                        .select()
                        .single()

                    if (error) {
                        throw new Error(`Failed to update tax invoice: ${error.message}`)
                    }
                    revalidatePath('/dashboard/account/pan-vat-billing/report')
                    return { success: true, data: updated }
                }
            }

            // Insert new record
            const { data: inserted, error } = await supabase
                .from('daraz_tax_invoices')
                .insert({
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
                    updated_at: new Date().toISOString()
                })
                .select()
                .single()

            if (error) {
                console.error('[Daraz Tax Invoices] Insert error:', error)
                throw new Error(`Failed to save tax invoice: ${error.message}`)
            }

            revalidatePath('/dashboard/account/pan-vat-billing/report')
            return { success: true, data: inserted }
        }
    } catch (err: any) {
        console.error('saveOrUpdateDarazTaxInvoice error:', err)
        throw err
    }
}

/**
 * Sync auto-calculated statement tax invoices into database
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

        // Prune any incorrect auto MMS invoices for non-Bagmati stores
        await supabase
            .from('daraz_tax_invoices')
            .delete()
            .eq('source', 'auto')
            .ilike('description', '%merchant managed%')
            .not('store_name', 'ilike', '%bagmati%')

        // Fetch existing records for matching statements to avoid overwriting user edits or verification state
        const statementNumbers = Array.from(new Set(invoices.map(i => i.statement_number).filter(Boolean)))
        
        let existingMap: Record<string, { id: string; is_verified: boolean }> = {}
        if (statementNumbers.length > 0) {
            const { data: existingRows } = await supabase
                .from('daraz_tax_invoices')
                .select('id, statement_number, store_name, description, is_verified')
                .in('statement_number', statementNumbers)
                .eq('source', 'auto')

            existingRows?.forEach((r: any) => {
                const key = `${r.statement_number}_${r.store_name}_${r.description}`
                existingMap[key] = { id: r.id, is_verified: !!r.is_verified }
            })
        }

        const toInsert: any[] = []
        const toUpdate: Array<{ id: string; data: any }> = []

        invoices.forEach(item => {
            const key = `${item.statement_number}_${item.store_name}_${item.description}`
            const existing = existingMap[key]

            if (existing) {
                // If user has locked/verified this invoice, NEVER overwrite their custom values!
                if (!existing.is_verified) {
                    toUpdate.push({
                        id: existing.id,
                        data: {
                            date: item.date,
                            date_period: item.date_period,
                            company_name: item.company_name,
                            taxable_amount: item.taxable_amount,
                            vat_amount: item.vat_amount,
                            grand_total: item.grand_total,
                            updated_at: new Date().toISOString()
                        }
                    })
                }
            } else {
                toInsert.push({
                    statement_number: item.statement_number || null,
                    date: item.date,
                    date_period: item.date_period,
                    store_name: item.store_name,
                    company_name: item.company_name,
                    description: item.description,
                    taxable_amount: item.taxable_amount,
                    vat_amount: item.vat_amount,
                    grand_total: item.grand_total,
                    is_verified: false,
                    source: 'auto',
                    fiscal_year_id: item.fiscal_year_id || null,
                    updated_at: new Date().toISOString()
                })
            }
        })

        for (const u of toUpdate) {
            await supabase.from('daraz_tax_invoices').update(u.data).eq('id', u.id)
        }

        if (toInsert.length > 0) {
            await supabase.from('daraz_tax_invoices').insert(toInsert)
        }

        return { success: true, count: invoices.length }
    } catch (err: any) {
        console.warn('[Daraz Tax Invoices] Sync warning:', err.message)
        return { success: false, error: err.message }
    }
}

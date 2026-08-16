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

        // Fetch existing records for matching statements to avoid overwriting existing verification state
        const statementNumbers = Array.from(new Set(invoices.map(i => i.statement_number).filter(Boolean)))
        
        let existingMap: Record<string, boolean> = {}
        if (statementNumbers.length > 0) {
            const { data: existingRows } = await supabase
                .from('daraz_tax_invoices')
                .select('statement_number, store_name, description, is_verified')
                .in('statement_number', statementNumbers)
                .eq('source', 'auto')

            existingRows?.forEach((r: any) => {
                const key = `${r.statement_number}_${r.store_name}_${r.description}`
                existingMap[key] = !!r.is_verified
            })
        }

        const rowsToUpsert = invoices.map(item => {
            const key = `${item.statement_number}_${item.store_name}_${item.description}`
            const alreadyVerified = existingMap[key] ?? false

            return {
                statement_number: item.statement_number || null,
                date: item.date,
                date_period: item.date_period,
                store_name: item.store_name,
                company_name: item.company_name,
                description: item.description,
                taxable_amount: item.taxable_amount,
                vat_amount: item.vat_amount,
                grand_total: item.grand_total,
                is_verified: alreadyVerified,
                source: 'auto',
                fiscal_year_id: item.fiscal_year_id || null,
                updated_at: new Date().toISOString()
            }
        })

        // Upsert in batches of 50
        for (let i = 0; i < rowsToUpsert.length; i += 50) {
            const batch = rowsToUpsert.slice(i, i + 50)
            await supabase
                .from('daraz_tax_invoices')
                .upsert(batch, {
                    onConflict: 'statement_number,store_name,description',
                    ignoreDuplicates: false
                })
        }

        return { success: true, count: rowsToUpsert.length }
    } catch (err: any) {
        console.warn('[Daraz Tax Invoices] Sync warning:', err.message)
        return { success: false, error: err.message }
    }
}

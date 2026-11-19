'use server'

import { createClient } from '@/lib/supabase/server'

export interface PurchaseBillingReportItem {
    supplier_company_id: string | null
    supplier_company_name: string | null
    buyer_company_id: string | null
    buyer_company_name: string | null
    total_bill_amount: number
    total_taxable_amount: number
    bill_count: number
    transaction_amount: number
    is_balance_verified: boolean
    balance_verified_at: string | null
}

export async function getPurchaseBillingReport(filters?: {
    companyId?: string
    fiscalYearId?: string
    startDate?: string
    endDate?: string
    search?: string
}) {
    const supabase = await createClient()

    // Build query to get aggregated data
    let query = supabase
        .from('pan_vat_bills')
        .select('supplier_company_id, supplier_company_name, buyer_company_id, buyer_company_name, total_amount, taxable_amount')
        .eq('is_deleted', false)

    // Filter by buyer company (Billed To)
    if (filters?.companyId && filters.companyId !== 'all') {
        query = query.eq('buyer_company_id', filters.companyId)
    }

    // Filter by fiscal year date range
    if (filters?.startDate && filters?.endDate) {
        query = query
            .gte('issue_bill_date_ad', filters.startDate)
            .lte('issue_bill_date_ad', filters.endDate)
    }

    // Search filter (search in supplier or buyer company names)
    if (filters?.search) {
        query = query.or(
            `supplier_company_name.ilike.%${filters.search}%,buyer_company_name.ilike.%${filters.search}%`
        )
    }

    const { data, error } = await query

    if (error) {
        console.error('Error fetching purchase billing report:', error)
        throw error
    }

    // Fetch cheque transactions matching selected fiscal year date range
    let txQuery = supabase
        .from('supplier_transactions')
        .select('cheque_name, amount')
        .eq('transaction_mode', 'Cheque')

    if (filters?.startDate && filters?.endDate) {
        txQuery = txQuery
            .gte('cheque_date', filters.startDate)
            .lte('cheque_date', filters.endDate)
    }

    const { data: txData, error: txError } = await txQuery
    if (txError) {
        console.error('Error fetching cheque transactions for report:', txError)
    }

    // Map transaction amounts by cheque_name (case-insensitive)
    const txAmounts: Record<string, number> = {}
    if (txData) {
        txData.forEach(tx => {
            if (tx.cheque_name) {
                const nameKey = tx.cheque_name.trim().toLowerCase()
                txAmounts[nameKey] = (txAmounts[nameKey] || 0) + (tx.amount || 0)
            }
        })
    }

    // Fetch verified balance confirmations for the selected fiscal year
    const verifiedMap: Record<string, { is_verified: boolean; verified_at: string | null }> = {}
    if (filters?.fiscalYearId) {
        const { data: bcData, error: bcError } = await supabase
            .from('balance_confirmations')
            .select('supplier_company_id, buyer_company_id, is_verified, verified_at')
            .eq('fiscal_year_id', filters.fiscalYearId)
            .eq('is_verified', true)

        if (bcError) {
            console.error('Error fetching balance confirmations for report:', bcError)
        } else if (bcData) {
            bcData.forEach(bc => {
                const key = `${bc.supplier_company_id || 'null'}_${bc.buyer_company_id || 'null'}`
                verifiedMap[key] = {
                    is_verified: Boolean(bc.is_verified),
                    verified_at: bc.verified_at || null,
                }
            })
        }
    }

    // Group and aggregate the data by supplier and buyer
    const aggregated = data.reduce((acc, bill) => {
        const key = `${bill.supplier_company_id || 'null'}_${bill.buyer_company_id || 'null'}`

        if (!acc[key]) {
            const companyNameKey = (bill.supplier_company_name || '').trim().toLowerCase()
            const transaction_amount = txAmounts[companyNameKey] || 0
            const verifiedInfo = verifiedMap[key]

            acc[key] = {
                supplier_company_id: bill.supplier_company_id,
                supplier_company_name: bill.supplier_company_name || 'Unknown Supplier',
                buyer_company_id: bill.buyer_company_id,
                buyer_company_name: bill.buyer_company_name || 'Unknown Buyer',
                total_bill_amount: 0,
                total_taxable_amount: 0,
                bill_count: 0,
                transaction_amount: transaction_amount,
                is_balance_verified: verifiedInfo?.is_verified || false,
                balance_verified_at: verifiedInfo?.verified_at || null,
            }
        }

        acc[key].total_bill_amount += bill.total_amount || 0
        acc[key].total_taxable_amount += bill.taxable_amount || 0
        acc[key].bill_count += 1

        return acc
    }, {} as Record<string, PurchaseBillingReportItem>)

    // Convert to array and sort by total amount descending
    return Object.values(aggregated).sort((a, b) => b.total_bill_amount - a.total_bill_amount)
}

'use server'

import { createClient } from '@/lib/supabase/server'
import type { PanVatBill } from './pan-vat-bill-actions'

export interface PurchaseBillingDetailParams {
    supplierCompanyId: string | null
    buyerCompanyId: string | null
    supplierCompanyName?: string | null
    fiscalYearId?: string | null
    startDate?: string
    endDate?: string
}

export interface PurchaseBillingDetailResult {
    bills: PanVatBill[]
    totalAmount: number
    totalTaxableAmount: number
    totalVatAmount: number
    supplierCompanyName: string | null
    buyerCompanyName: string | null
    chequeTransactions: any[]
    totalChequeAmount: number
    isBalanceVerified: boolean
    balanceVerifiedAt: string | null
}

export async function getPurchaseBillingDetail(params: PurchaseBillingDetailParams): Promise<PurchaseBillingDetailResult> {
    const supabase = await createClient()

    // Build query to get all bills for this supplier-buyer combination
    let query = supabase
        .from('pan_vat_bills')
        .select('*')
        .eq('is_deleted', false)
        .order('issue_bill_date_ad', { ascending: false })

    // Filter by supplier company
    if (params.supplierCompanyId) {
        query = query.eq('supplier_company_id', params.supplierCompanyId)
    } else {
        query = query.is('supplier_company_id', null)
    }

    // Filter by buyer company
    if (params.buyerCompanyId) {
        query = query.eq('buyer_company_id', params.buyerCompanyId)
    } else {
        query = query.is('buyer_company_id', null)
    }

    // Filter by fiscal year date range
    if (params.startDate && params.endDate) {
        query = query
            .gte('issue_bill_date_ad', params.startDate)
            .lte('issue_bill_date_ad', params.endDate)
    }

    const { data: bills, error } = await query

    if (error) {
        console.error('Error fetching purchase billing detail:', error)
        throw error
    }

    // Calculate total amounts
    const totalAmount = bills.reduce((sum, bill) => sum + (bill.total_amount || 0), 0)
    const totalTaxableAmount = bills.reduce((sum, bill) => sum + (bill.taxable_amount || 0), 0)
    const totalVatAmount = bills.reduce((sum, bill) => sum + (bill.vat_13_percent || 0), 0)

    // Check balance confirmation verification status for this fiscal year
    let isBalanceVerified = false
    let balanceVerifiedAt: string | null = null
    if (params.fiscalYearId) {
        let bcQuery = supabase
            .from('balance_confirmations')
            .select('is_verified, verified_at')
            .eq('fiscal_year_id', params.fiscalYearId)

        if (params.supplierCompanyId) {
            bcQuery = bcQuery.eq('supplier_company_id', params.supplierCompanyId)
        } else {
            bcQuery = bcQuery.is('supplier_company_id', null)
        }

        if (params.buyerCompanyId) {
            bcQuery = bcQuery.eq('buyer_company_id', params.buyerCompanyId)
        } else {
            bcQuery = bcQuery.is('buyer_company_id', null)
        }

        const { data: bcRow } = await bcQuery.maybeSingle()
        if (bcRow) {
            isBalanceVerified = Boolean(bcRow.is_verified)
            balanceVerifiedAt = bcRow.verified_at || null
        }
    }

    // Get supplier and buyer names (from params or first bill if available)
    const resolvedSupplierName = params.supplierCompanyName || bills[0]?.supplier_company_name || null
    const resolvedBuyerName = bills[0]?.buyer_company_name || null

    // Fetch cheque transactions matching the supplier company name and fiscal year range
    let chequeTransactions: any[] = []
    let totalChequeAmount = 0

    if (resolvedSupplierName) {
        let txQuery = supabase
            .from('supplier_transactions')
            .select(`
                *,
                supplier:suppliers(supplier_name)
            `)
            .eq('transaction_mode', 'Cheque')
            .eq('cheque_name', resolvedSupplierName)

        if (params.startDate && params.endDate) {
            txQuery = txQuery
                .gte('cheque_date', params.startDate)
                .lte('cheque_date', params.endDate)
        }

        const { data: txData, error: txError } = await txQuery
        if (txError) {
            console.error('Error fetching cheque transactions for detail modal:', txError)
        } else if (txData) {
            chequeTransactions = txData
            totalChequeAmount = txData.reduce((sum, tx) => sum + (tx.amount || 0), 0)
        }
    }

    return {
        bills: bills as PanVatBill[],
        totalAmount,
        totalTaxableAmount,
        totalVatAmount,
        supplierCompanyName: resolvedSupplierName,
        buyerCompanyName: resolvedBuyerName,
        chequeTransactions,
        totalChequeAmount,
        isBalanceVerified,
        balanceVerifiedAt,
    }
}

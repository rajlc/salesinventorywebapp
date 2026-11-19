'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface BalanceConfirmationExtraData {
    purchaseReturnTaxable?: number
    purchaseReturnVat?: number
    purchaseReturnExempted?: number
    purchaseExpBrkTaxable?: number
    purchaseExpBrkVat?: number
    purchaseExpBrkExempted?: number
    debitNoteTaxable?: number
    debitNoteVat?: number
    debitNoteExempted?: number
    salesTaxable?: number
    salesVat?: number
    salesExempted?: number
    salesReturnTaxable?: number
    salesReturnVat?: number
    salesReturnExempted?: number
    salesExpBrkTaxable?: number
    salesExpBrkVat?: number
    salesExpBrkExempted?: number
    creditNoteTaxable?: number
    creditNoteVat?: number
    creditNoteExempted?: number
}

export interface BalanceConfirmationRecord {
    id: string
    supplier_company_id: string | null
    buyer_company_id: string | null
    fiscal_year_id: string
    supplier_company_name: string | null
    buyer_company_name: string | null
    party_address: string | null
    letter_date_ad: string | null
    letter_date_bs: string | null
    taxable_amount: number
    vat_amount: number
    exempted_amount: number
    total_bill_amount: number
    opening_balance: number
    opening_balance_type: 'Dr' | 'Cr'
    closing_balance: number
    closing_balance_type: 'Dr' | 'Cr'
    extra_data: BalanceConfirmationExtraData
    is_verified: boolean
    verified_at: string | null
    verified_by: string | null
    remarks: string | null
    created_at: string
    updated_at: string
}

export interface BalanceConfirmationContext {
    ourCompany: {
        id: string | null
        company_name: string
        address: string
        pan_vat_no: string
    }
    partyCompany: {
        id: string | null
        company_name: string
        address: string
        pan_vat_no: string
    }
    confirmation: BalanceConfirmationRecord | null
}

async function findExistingConfirmation(
    supabase: Awaited<ReturnType<typeof createClient>>,
    supplierCompanyId: string | null,
    buyerCompanyId: string | null,
    fiscalYearId: string
): Promise<BalanceConfirmationRecord | null> {
    let query = supabase
        .from('balance_confirmations')
        .select('*')
        .eq('fiscal_year_id', fiscalYearId)

    if (supplierCompanyId) {
        query = query.eq('supplier_company_id', supplierCompanyId)
    } else {
        query = query.is('supplier_company_id', null)
    }

    if (buyerCompanyId) {
        query = query.eq('buyer_company_id', buyerCompanyId)
    } else {
        query = query.is('buyer_company_id', null)
    }

    const { data, error } = await query.maybeSingle()
    if (error) {
        console.error('Error finding existing balance confirmation:', error)
        return null
    }

    return data as BalanceConfirmationRecord | null
}

export async function getBalanceConfirmationContext(params: {
    supplierCompanyId: string | null
    buyerCompanyId: string | null
    supplierCompanyName?: string | null
    buyerCompanyName?: string | null
    supplierPanVat?: string | null
    buyerPanVat?: string | null
    fiscalYearId?: string | null
}): Promise<BalanceConfirmationContext> {
    const supabase = await createClient()

    let ourCompany = {
        id: params.buyerCompanyId,
        company_name: params.buyerCompanyName || '',
        address: '',
        pan_vat_no: params.buyerPanVat || '',
    }

    if (params.buyerCompanyId) {
        const { data } = await supabase
            .from('company_details')
            .select('id, company_name, address, pan_vat_details')
            .eq('id', params.buyerCompanyId)
            .maybeSingle()

        if (data) {
            ourCompany = {
                id: data.id,
                company_name: data.company_name || ourCompany.company_name,
                address: data.address || '',
                pan_vat_no: data.pan_vat_details || ourCompany.pan_vat_no,
            }
        }
    }

    let partyCompany = {
        id: params.supplierCompanyId,
        company_name: params.supplierCompanyName || '',
        address: '',
        pan_vat_no: params.supplierPanVat || '',
    }

    if (params.supplierCompanyId) {
        const { data } = await supabase
            .from('pan_vat_companies')
            .select('id, company_name, pan_vat_no, address')
            .eq('id', params.supplierCompanyId)
            .maybeSingle()

        if (data) {
            partyCompany = {
                id: data.id,
                company_name: data.company_name || partyCompany.company_name,
                address: data.address || '',
                pan_vat_no: data.pan_vat_no || partyCompany.pan_vat_no,
            }
        }
    }

    let confirmation: BalanceConfirmationRecord | null = null
    if (params.fiscalYearId) {
        confirmation = await findExistingConfirmation(
            supabase,
            params.supplierCompanyId,
            params.buyerCompanyId,
            params.fiscalYearId
        )
    }

    return {
        ourCompany,
        partyCompany,
        confirmation,
    }
}

export interface SaveBalanceConfirmationParams {
    supplierCompanyId: string | null
    buyerCompanyId: string | null
    fiscalYearId: string
    supplierCompanyName: string | null
    buyerCompanyName: string | null
    partyAddress: string
    letterDateAd: string
    letterDateBs: string
    taxableAmount: number
    vatAmount: number
    exemptedAmount: number
    totalBillAmount: number
    openingBalance: number
    openingBalanceType: 'Dr' | 'Cr'
    closingBalance: number
    closingBalanceType: 'Dr' | 'Cr'
    extraData?: BalanceConfirmationExtraData
    isVerified?: boolean
    remarks?: string | null
}

export async function saveBalanceConfirmation(params: SaveBalanceConfirmationParams): Promise<BalanceConfirmationRecord> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const existing = await findExistingConfirmation(
        supabase,
        params.supplierCompanyId,
        params.buyerCompanyId,
        params.fiscalYearId
    )

    // Save party address back to pan_vat_companies if provided
    if (params.supplierCompanyId && params.partyAddress.trim()) {
        await supabase
            .from('pan_vat_companies')
            .update({ address: params.partyAddress.trim(), updated_at: new Date().toISOString() })
            .eq('id', params.supplierCompanyId)
    }

    const nowIso = new Date().toISOString()
    const payload: Record<string, unknown> = {
        supplier_company_id: params.supplierCompanyId,
        buyer_company_id: params.buyerCompanyId,
        fiscal_year_id: params.fiscalYearId,
        supplier_company_name: params.supplierCompanyName,
        buyer_company_name: params.buyerCompanyName,
        party_address: params.partyAddress.trim() || null,
        letter_date_ad: params.letterDateAd,
        letter_date_bs: params.letterDateBs,
        taxable_amount: params.taxableAmount,
        vat_amount: params.vatAmount,
        exempted_amount: params.exemptedAmount,
        total_bill_amount: params.totalBillAmount,
        opening_balance: params.openingBalance,
        opening_balance_type: params.openingBalanceType,
        closing_balance: params.closingBalance,
        closing_balance_type: params.closingBalanceType,
        extra_data: params.extraData || {},
        remarks: params.remarks ?? null,
        updated_at: nowIso,
    }

    if (typeof params.isVerified === 'boolean') {
        payload.is_verified = params.isVerified
        payload.verified_at = params.isVerified ? (existing?.verified_at || nowIso) : null
        payload.verified_by = params.isVerified ? (user?.id || existing?.verified_by || null) : null
    }

    let resultData: BalanceConfirmationRecord

    if (existing) {
        const { data, error } = await supabase
            .from('balance_confirmations')
            .update(payload)
            .eq('id', existing.id)
            .select('*')
            .single()

        if (error) {
            console.error('Error updating balance confirmation:', error)
            throw error
        }
        resultData = data as BalanceConfirmationRecord
    } else {
        const { data, error } = await supabase
            .from('balance_confirmations')
            .insert({
                ...payload,
                created_by: user?.id || null,
            })
            .select('*')
            .single()

        if (error) {
            console.error('Error inserting balance confirmation:', error)
            throw error
        }
        resultData = data as BalanceConfirmationRecord
    }

    revalidatePath('/dashboard/account/pan-vat-billing/purchase-billing')
    return resultData
}

export async function setBalanceConfirmationVerified(params: {
    supplierCompanyId: string | null
    buyerCompanyId: string | null
    fiscalYearId: string
    supplierCompanyName: string | null
    buyerCompanyName: string | null
    taxableAmount: number
    vatAmount: number
    totalBillAmount: number
    isVerified: boolean
}): Promise<BalanceConfirmationRecord> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const existing = await findExistingConfirmation(
        supabase,
        params.supplierCompanyId,
        params.buyerCompanyId,
        params.fiscalYearId
    )

    const nowIso = new Date().toISOString()

    if (existing) {
        const { data, error } = await supabase
            .from('balance_confirmations')
            .update({
                is_verified: params.isVerified,
                verified_at: params.isVerified ? nowIso : null,
                verified_by: params.isVerified ? (user?.id || null) : null,
                updated_at: nowIso,
            })
            .eq('id', existing.id)
            .select('*')
            .single()

        if (error) {
            console.error('Error toggling balance confirmation verified:', error)
            throw error
        }

        revalidatePath('/dashboard/account/pan-vat-billing/purchase-billing')
        return data as BalanceConfirmationRecord
    }

    const { data, error } = await supabase
        .from('balance_confirmations')
        .insert({
            supplier_company_id: params.supplierCompanyId,
            buyer_company_id: params.buyerCompanyId,
            fiscal_year_id: params.fiscalYearId,
            supplier_company_name: params.supplierCompanyName,
            buyer_company_name: params.buyerCompanyName,
            taxable_amount: params.taxableAmount,
            vat_amount: params.vatAmount,
            exempted_amount: 0,
            total_bill_amount: params.totalBillAmount,
            opening_balance: 0,
            opening_balance_type: 'Cr',
            closing_balance: 0,
            closing_balance_type: 'Cr',
            extra_data: {},
            is_verified: params.isVerified,
            verified_at: params.isVerified ? nowIso : null,
            verified_by: params.isVerified ? (user?.id || null) : null,
            created_by: user?.id || null,
        })
        .select('*')
        .single()

    if (error) {
        console.error('Error creating verified balance confirmation:', error)
        throw error
    }

    revalidatePath('/dashboard/account/pan-vat-billing/purchase-billing')
    return data as BalanceConfirmationRecord
}

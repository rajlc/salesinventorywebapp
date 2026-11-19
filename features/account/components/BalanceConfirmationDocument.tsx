'use client'

import React from 'react'

export interface BalanceConfirmationFormValues {
    // Sender (Our Company)
    ourCompanyName: string
    ourCompanyAddress: string
    ourCompanyPanVat: string

    // Recipient (Party)
    partyCompanyName: string
    partyAddress: string
    partyPanVat: string

    // Dates & Fiscal Year
    dateAd: string // YYYY-MM-DD
    dateBs: string // YYYY-MM-DD or YYYY/MM/DD
    bsFiscalYearLabel: string // e.g., "2082/83"
    bsEndMonthYearLabel: string // e.g., "Ashad 2083"

    // Purchase Table
    purchaseTaxable: number
    purchaseVat: number
    purchaseExempted: number
    purchaseReturnTaxable: number
    purchaseReturnVat: number
    purchaseReturnExempted: number
    purchaseExpBrkTaxable: number
    purchaseExpBrkVat: number
    purchaseExpBrkExempted: number
    debitNoteTaxable: number
    debitNoteVat: number
    debitNoteExempted: number

    // Sales Table
    salesTaxable: number
    salesVat: number
    salesExempted: number
    salesReturnTaxable: number
    salesReturnVat: number
    salesReturnExempted: number
    salesExpBrkTaxable: number
    salesExpBrkVat: number
    salesExpBrkExempted: number
    creditNoteTaxable: number
    creditNoteVat: number
    creditNoteExempted: number

    // Balances
    openingBalance: number
    openingBalanceType: 'Dr' | 'Cr'
    closingBalance: number
    closingBalanceType: 'Dr' | 'Cr'
}

export function formatAmount(val: number): string {
    const num = Number.isFinite(val) ? val : 0
    return num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })
}

export function formatAdDateSlash(dateStr: string): string {
    if (!dateStr) return ''
    // Convert YYYY-MM-DD to MM/DD/YYYY (matching sample format 07/16/2026)
    const parts = dateStr.split('-')
    if (parts.length === 3) {
        return `${parts[1]}/${parts[2]}/${parts[0]}`
    }
    return dateStr
}

export function formatBsDateSlash(dateStr: string): string {
    if (!dateStr) return ''
    return dateStr.replace(/-/g, '/')
}

export function computeBalanceTotals(v: BalanceConfirmationFormValues) {
    const purchaseTotalTaxable =
        (v.purchaseTaxable || 0) -
        (v.purchaseReturnTaxable || 0) +
        (v.purchaseExpBrkTaxable || 0) -
        (v.debitNoteTaxable || 0)
    const purchaseTotalVat =
        (v.purchaseVat || 0) -
        (v.purchaseReturnVat || 0) +
        (v.purchaseExpBrkVat || 0) -
        (v.debitNoteVat || 0)
    const purchaseTotalExempted =
        (v.purchaseExempted || 0) -
        (v.purchaseReturnExempted || 0) +
        (v.purchaseExpBrkExempted || 0) -
        (v.debitNoteExempted || 0)

    const salesTotalTaxable =
        (v.salesTaxable || 0) -
        (v.salesReturnTaxable || 0) +
        (v.salesExpBrkTaxable || 0) -
        (v.creditNoteTaxable || 0)
    const salesTotalVat =
        (v.salesVat || 0) -
        (v.salesReturnVat || 0) +
        (v.salesExpBrkVat || 0) -
        (v.creditNoteVat || 0)
    const salesTotalExempted =
        (v.salesExempted || 0) -
        (v.salesReturnExempted || 0) +
        (v.salesExpBrkExempted || 0) -
        (v.creditNoteExempted || 0)

    const purchaseAnnex13 = purchaseTotalTaxable + purchaseTotalExempted
    const salesAnnex13 = salesTotalTaxable + salesTotalExempted

    return {
        purchaseTotalTaxable,
        purchaseTotalVat,
        purchaseTotalExempted,
        salesTotalTaxable,
        salesTotalVat,
        salesTotalExempted,
        purchaseAnnex13,
        salesAnnex13,
    }
}

interface BalanceConfirmationDocumentProps {
    values: BalanceConfirmationFormValues
}

export function BalanceConfirmationDocument({ values }: BalanceConfirmationDocumentProps) {
    const totals = computeBalanceTotals(values)

    return (
        <div
            className="bg-white text-black mx-auto shadow-md border border-gray-300"
            style={{
                width: '210mm',
                minHeight: '270mm',
                padding: '14mm 14mm 12mm 14mm',
                fontFamily: 'Arial, Helvetica, sans-serif',
                fontSize: '11.5px',
                lineHeight: 1.45,
                color: '#111111',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
            }}
        >
            <div>
                {/* Header: Sender (Our Company) */}
                <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                        {values.ourCompanyName || 'YOUR COMPANY NAME'}
                    </div>
                    {values.ourCompanyAddress && (
                        <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', marginTop: '2px' }}>
                            ({values.ourCompanyAddress})
                        </div>
                    )}
                    <div style={{ fontSize: '11.5px', fontWeight: 600, marginTop: '6px' }}>
                        VAT/PAN NO: {values.ourCompanyPanVat || 'N/A'}
                    </div>
                </div>

                <hr style={{ border: 0, borderTop: '1.5px solid #222', marginBottom: '14px' }} />

                {/* Party Details & Dates */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                    <table style={{ borderCollapse: 'collapse', fontSize: '11.5px' }}>
                        <tbody>
                            <tr>
                                <td style={{ padding: '1px 10px 1px 0', fontWeight: 600, width: '62px' }}>M/s.</td>
                                <td style={{ padding: '1px 8px 1px 0' }}>:</td>
                                <td style={{ padding: '1px 0', fontWeight: 700, textTransform: 'uppercase' }}>
                                    {values.partyCompanyName || 'N/A'}
                                </td>
                            </tr>
                            <tr>
                                <td style={{ padding: '1px 10px 1px 0', fontWeight: 600 }}>Address</td>
                                <td style={{ padding: '1px 8px 1px 0' }}>:</td>
                                <td style={{ padding: '1px 0', textTransform: 'uppercase' }}>
                                    {values.partyAddress || '-'}
                                </td>
                            </tr>
                            <tr>
                                <td style={{ padding: '1px 10px 1px 0', fontWeight: 600 }}>PAN</td>
                                <td style={{ padding: '1px 8px 1px 0' }}>:</td>
                                <td style={{ padding: '1px 0' }}>
                                    {values.partyPanVat || '-'}
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <table style={{ borderCollapse: 'collapse', fontSize: '11.5px' }}>
                        <tbody>
                            <tr>
                                <td style={{ padding: '1px 10px 1px 0', fontWeight: 700 }}>Date</td>
                                <td style={{ padding: '1px 8px 1px 0' }}>:</td>
                                <td style={{ padding: '1px 0' }}>{formatAdDateSlash(values.dateAd)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Subject */}
                <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                    <span style={{ fontWeight: 700, fontSize: '12.5px', textDecoration: 'underline' }}>
                        SUBJECT : Transaction &amp; Balance Confirmation For F/Y- {values.bsFiscalYearLabel}
                    </span>
                </div>

                {/* Salutation & Intro */}
                <div style={{ marginBottom: '10px' }}>
                    <div style={{ marginBottom: '6px' }}>Dear Sir/Madam,</div>
                    <div style={{ textIndent: '42px', textAlign: 'justify' }}>
                        With reference to above, we are sending you the following information regarding sales, purchases &amp; balances at the end of {values.bsEndMonthYearLabel} for your confirmation :
                    </div>
                </div>

                {/* Side-by-Side Purchase & Sales Tables */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                    {/* PURCHASE TABLE */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px', border: '1px solid #222' }}>
                        <thead>
                            <tr>
                                <th colSpan={4} style={{ border: '1px solid #222', padding: '5px', textAlign: 'center', fontWeight: 700, fontSize: '11.5px' }}>
                                    PURCHASE
                                </th>
                            </tr>
                            <tr>
                                <th style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'left', fontWeight: 700 }}>Bill Types</th>
                                <th style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right', fontWeight: 700 }}>Taxable</th>
                                <th style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right', fontWeight: 700 }}>VAT</th>
                                <th style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right', fontWeight: 700 }}>Exempted</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style={{ border: '1px solid #222', padding: '4px 5px' }}>Purchase</td>
                                <td style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right' }}>{formatAmount(values.purchaseTaxable)}</td>
                                <td style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right' }}>{formatAmount(values.purchaseVat)}</td>
                                <td style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right' }}>{formatAmount(values.purchaseExempted)}</td>
                            </tr>
                            <tr>
                                <td style={{ border: '1px solid #222', padding: '4px 5px' }}>Purchase Return</td>
                                <td style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right' }}>{formatAmount(values.purchaseReturnTaxable)}</td>
                                <td style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right' }}>{formatAmount(values.purchaseReturnVat)}</td>
                                <td style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right' }}>{formatAmount(values.purchaseReturnExempted)}</td>
                            </tr>
                            <tr>
                                <td style={{ border: '1px solid #222', padding: '4px 5px' }}>Purchase Exp. Brk.</td>
                                <td style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right' }}>{formatAmount(values.purchaseExpBrkTaxable)}</td>
                                <td style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right' }}>{formatAmount(values.purchaseExpBrkVat)}</td>
                                <td style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right' }}>{formatAmount(values.purchaseExpBrkExempted)}</td>
                            </tr>
                            <tr>
                                <td style={{ border: '1px solid #222', padding: '4px 5px' }}>Debit Note</td>
                                <td style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right' }}>{formatAmount(values.debitNoteTaxable)}</td>
                                <td style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right' }}>{formatAmount(values.debitNoteVat)}</td>
                                <td style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right' }}>{formatAmount(values.debitNoteExempted)}</td>
                            </tr>
                            <tr style={{ fontWeight: 700 }}>
                                <td style={{ border: '1px solid #222', padding: '4px 5px' }}>Total</td>
                                <td style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right' }}>{formatAmount(totals.purchaseTotalTaxable)}</td>
                                <td style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right' }}>{formatAmount(totals.purchaseTotalVat)}</td>
                                <td style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right' }}>{formatAmount(totals.purchaseTotalExempted)}</td>
                            </tr>
                        </tbody>
                    </table>

                    {/* SALES TABLE */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px', border: '1px solid #222' }}>
                        <thead>
                            <tr>
                                <th colSpan={4} style={{ border: '1px solid #222', padding: '5px', textAlign: 'center', fontWeight: 700, fontSize: '11.5px' }}>
                                    SALES
                                </th>
                            </tr>
                            <tr>
                                <th style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'left', fontWeight: 700 }}>Bill Types</th>
                                <th style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right', fontWeight: 700 }}>Taxable</th>
                                <th style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right', fontWeight: 700 }}>VAT</th>
                                <th style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right', fontWeight: 700 }}>Exempted</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style={{ border: '1px solid #222', padding: '4px 5px' }}>Sales</td>
                                <td style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right' }}>{formatAmount(values.salesTaxable)}</td>
                                <td style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right' }}>{formatAmount(values.salesVat)}</td>
                                <td style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right' }}>{formatAmount(values.salesExempted)}</td>
                            </tr>
                            <tr>
                                <td style={{ border: '1px solid #222', padding: '4px 5px' }}>Sales Return</td>
                                <td style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right' }}>{formatAmount(values.salesReturnTaxable)}</td>
                                <td style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right' }}>{formatAmount(values.salesReturnVat)}</td>
                                <td style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right' }}>{formatAmount(values.salesReturnExempted)}</td>
                            </tr>
                            <tr>
                                <td style={{ border: '1px solid #222', padding: '4px 5px' }}>Sales Exp. Brk.</td>
                                <td style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right' }}>{formatAmount(values.salesExpBrkTaxable)}</td>
                                <td style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right' }}>{formatAmount(values.salesExpBrkVat)}</td>
                                <td style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right' }}>{formatAmount(values.salesExpBrkExempted)}</td>
                            </tr>
                            <tr>
                                <td style={{ border: '1px solid #222', padding: '4px 5px' }}>Credit Note</td>
                                <td style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right' }}>{formatAmount(values.creditNoteTaxable)}</td>
                                <td style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right' }}>{formatAmount(values.creditNoteVat)}</td>
                                <td style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right' }}>{formatAmount(values.creditNoteExempted)}</td>
                            </tr>
                            <tr style={{ fontWeight: 700 }}>
                                <td style={{ border: '1px solid #222', padding: '4px 5px' }}>Total</td>
                                <td style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right' }}>{formatAmount(totals.salesTotalTaxable)}</td>
                                <td style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right' }}>{formatAmount(totals.salesTotalVat)}</td>
                                <td style={{ border: '1px solid #222', padding: '4px 5px', textAlign: 'right' }}>{formatAmount(totals.salesTotalExempted)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Opening/Closing Balance & Annex-13 Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px', fontSize: '11.5px' }}>
                    <table style={{ borderCollapse: 'collapse' }}>
                        <tbody>
                            <tr>
                                <td style={{ padding: '2px 12px 2px 0', width: '130px' }}>Opening Balance :</td>
                                <td style={{ padding: '2px 0', fontWeight: 700 }}>
                                    {formatAmount(values.openingBalance)} {values.openingBalanceType}
                                </td>
                            </tr>
                            <tr>
                                <td style={{ padding: '2px 12px 2px 0' }}>Purchase Annex-13 :</td>
                                <td style={{ padding: '2px 0', fontWeight: 700 }}>
                                    {formatAmount(totals.purchaseAnnex13)}
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <table style={{ borderCollapse: 'collapse' }}>
                        <tbody>
                            <tr>
                                <td style={{ padding: '2px 12px 2px 0', width: '130px' }}>Closing Balance :</td>
                                <td style={{ padding: '2px 0', fontWeight: 700 }}>
                                    {formatAmount(values.closingBalance)} {values.closingBalanceType}
                                </td>
                            </tr>
                            <tr>
                                <td style={{ padding: '2px 12px 2px 0' }}>Sales Annex-13 :</td>
                                <td style={{ padding: '2px 0', fontWeight: 700 }}>
                                    {formatAmount(totals.salesAnnex13)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Declaration Body */}
                <div style={{ marginBottom: '14px', textAlign: 'justify' }}>
                    Detail ledger confirming above information has been enclosed herewithin. Please send us the received copy with sign &amp; official stamp on this letter within 15 days of its receipt, failing to which the details provided by us will be treated as final confirmation at the year end.
                </div>

                <div style={{ marginBottom: '14px' }}>Thank you !</div>

                <div style={{ fontWeight: 600, marginBottom: '56px' }}>
                    We confirm the above transaction are true;
                </div>

                {/* Dual Signature & Seal Blocks (Kept Blank for Physical Stamp & Signature) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '24px' }}>
                    {/* Left: Party Signature & Seal */}
                    <div style={{ width: '48%' }}>
                        <div style={{ height: '48px' }} />
                        <div style={{ fontWeight: 700, marginBottom: '10px' }}>Authorized Signature &amp; Seal</div>
                        <div style={{ marginBottom: '8px' }}>
                            <span>Name: </span>
                            <span style={{ fontWeight: 600, textTransform: 'uppercase' }}>
                                {values.partyCompanyName || ''}
                            </span>
                        </div>
                        <div>Date: _______________________</div>
                    </div>

                    {/* Right: Our Company Signature & Seal */}
                    <div style={{ width: '44%', textAlign: 'right' }}>
                        <div style={{ height: '48px' }} />
                        <div style={{ fontWeight: 700, marginBottom: '10px' }}>Authorized Signature &amp; Seal</div>
                        <div style={{ fontWeight: 700, textTransform: 'uppercase' }}>
                            FOR: {values.ourCompanyName || ''}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Footer Line */}
            <div style={{ marginTop: '36px' }}>
                <hr style={{ border: 0, borderTop: '1.5px solid #222' }} />
            </div>
        </div>
    )
}

'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { getDarazOrderById, markDarazOrdersAsPrinted } from '@/features/sales/actions/daraz-actions'

export default function DarazInvoicePage() {
    const params = useParams()
    const orderId = params.id as string
    const [order, setOrder] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!orderId) return

        getDarazOrderById(orderId)
            .then(data => {
                setOrder(data)
                setLoading(false)
                // Mark as printed
                markDarazOrdersAsPrinted([orderId]).catch(err => console.error('Failed to mark printed:', err))
            })
            .catch(err => {
                console.error(err)
                setLoading(false)
            })
    }, [orderId])

    useEffect(() => {
        if (order && !loading) {
            // Small delay to ensure render is complete before print dialog
            setTimeout(() => {
                window.print()
            }, 500)
        }
    }, [order, loading])

    const numberToWords = (num: number): string => {
        const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen ']
        const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

        if ((num = num.toString() as any).length > 9) return 'overflow'
        const n: any = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/)
        if (!n) return ''
        let str = ''
        str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : ''
        str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : ''
        str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : ''
        str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : ''
        str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + 'Only' : 'Only'
        return 'Total ' + str
    }

    if (loading) return <div className="p-8 text-center">Loading Invoice...</div>
    if (!order) return <div className="p-8 text-center text-red-500">Invoice not found or error loading.</div>

    const store = order.store
    const totalAmount = order.items?.reduce((sum: number, item: any) => sum + (item.amount * item.quantity), 0) || 0
    // Use seller account from first item for the Info field, but prefer Store Company Name for the Header
    const sellerAccount = order.items?.[0]?.seller_account || 'N/A'

    return (
        <div className="bg-white min-h-screen p-8 text-black font-sans">
            {/* Styles for print specifically injected here to ensure they apply in this context */}
            <style jsx global>{`
                @media print {
                    @page { margin: 0; }
                    body { -webkit-print-color-adjust: exact; }
                }
                .header-company { font-size: 18px; font-weight: bold; text-align: center; }
                .header-sub { font-size: 12px; text-align: center; margin-top: 2px; }
                .horizontal-line { border-bottom: 1px solid black; margin: 10px 0; }
                .dotted-line { border-bottom: 1px dotted black; margin: 5px 0; width: 100%; }
                .info-row { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px; }
                .info-left { text-align: left; }
                .info-right { text-align: right; }
                .invoice-table { width: 100%; border-collapse: collapse; border: 1px solid black; margin-top: 5px; font-size: 11px; }
                .invoice-table th { border: 1px solid black; padding: 4px; text-align: center; font-weight: bold; height: 28px; }
                .invoice-table td { border: 1px solid black; padding: 4px; vertical-align: top; }
                .row-min-height { height: 35px; }
                .footer { text-align: center; font-size: 10px; margin-top: 20px; }
            `}</style>

            <div className="max-w-[190mm] mx-auto">
                {/* Header Section */}
                <div className="header-company">
                    {store?.company_name || '{Company Name}'}
                </div>
                <div className="header-sub">
                    {store?.address || '{Address}'}
                </div>
                <div className="header-sub">
                    Contact - {store?.contact || '{Contact}'}
                </div>
                <div className="horizontal-line"></div>

                {/* Info Section */}
                <div className="info-row">
                    <div className="info-left" style={{ width: '50%' }}>
                        <strong>PAN No:</strong> {store?.pan_vat_number || 'N/A'}
                    </div>
                    <div className="info-right" style={{ width: '50%' }}>
                        <strong>Date:</strong> {new Date(order.order_date).toLocaleDateString()}
                    </div>
                </div>
                <div className="info-row">
                    <div className="info-left" style={{ width: '50%' }}>
                        <strong>Seller:</strong> {sellerAccount}
                    </div>
                    <div className="info-right" style={{ width: '50%' }}>
                        <strong>Invoice Number:</strong> {order.invoice_number}
                    </div>
                </div>
                <div className="info-row" style={{ marginTop: '5px' }}>
                    <div className="info-left">
                        <strong>Mr/Mrs:</strong> {order.customer_name}
                    </div>
                </div>

                <div className="dotted-line"></div>

                {/* Table */}
                <table className="invoice-table">
                    <thead>
                        <tr>
                            <th style={{ width: '8%', borderBottom: '1px solid black' }}>S.N</th>
                            <th style={{ width: '42%', borderBottom: '1px solid black' }}>Particular</th>
                            <th style={{ width: '10%', borderBottom: '1px solid black' }}>Qty</th>
                            <th style={{ width: '20%', borderBottom: '1px solid black' }}>Amount</th>
                            <th style={{ width: '20%', borderBottom: '1px solid black' }}>Total Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {order.items?.map((item: any, index: number) => (
                            <tr key={index} className="row-min-height">
                                <td style={{ textAlign: 'center', borderBottom: 'none', borderTop: 'none' }}>{index + 1}</td>
                                <td style={{ textAlign: 'left', paddingLeft: '8px', borderBottom: 'none', borderTop: 'none' }}>
                                    {item.product_name || item.seller_sku}
                                </td>
                                <td style={{ textAlign: 'center', borderBottom: 'none', borderTop: 'none' }}>{item.quantity}</td>
                                <td style={{ textAlign: 'center', borderBottom: 'none', borderTop: 'none' }}>{item.amount.toLocaleString()}</td>
                                <td style={{ textAlign: 'center', borderBottom: 'none', borderTop: 'none' }}>{(item.amount * item.quantity).toLocaleString()}</td>
                            </tr>
                        ))}
                        {/* Fill empty rows */}
                        {Array.from({ length: Math.max(0, 8 - (order.items?.length || 0)) }).map((_, i) => (
                            <tr key={`empty-${i}`} className="row-min-height">
                                <td style={{ borderBottom: 'none', borderTop: 'none' }}></td>
                                <td style={{ borderBottom: 'none', borderTop: 'none' }}></td>
                                <td style={{ borderBottom: 'none', borderTop: 'none' }}></td>
                                <td style={{ borderBottom: 'none', borderTop: 'none' }}></td>
                                <td style={{ borderBottom: 'none', borderTop: 'none' }}></td>
                            </tr>
                        ))}

                        {/* Total Row */}
                        <tr style={{ borderTop: '1px solid black' }}>
                            <td colSpan={4} style={{ textAlign: 'left', paddingLeft: '8px', fontWeight: 'bold' }}>
                                {numberToWords(Math.round(totalAmount))}
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                                {totalAmount.toLocaleString()}
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* Footer */}
                <div className="footer" style={{ marginTop: '20px' }}>
                    {order.remarks ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '10px' }}>
                            <div style={{ textAlign: 'left', fontWeight: 'normal' }}>
                                Remarks: <strong style={{ fontWeight: 'bold' }}>"{order.remarks}"</strong>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                This is a computer-generated bill. If you find any issue, please contact us.
                            </div>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center' }}>
                            This is a computer-generated bill. If you find any issue, please contact us.
                        </div>
                    )}
                    <div className="dotted-line" style={{ marginTop: '5px' }}></div>
                </div>
            </div>
        </div>
    )
}

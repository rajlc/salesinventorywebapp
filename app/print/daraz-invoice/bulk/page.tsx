'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { getDarazOrderById, markDarazOrdersAsPrinted } from '@/features/sales/actions/daraz-actions'

function BulkInvoiceContent() {
    const searchParams = useSearchParams()
    const idsParam = searchParams.get('ids')
    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!idsParam) {
            setLoading(false)
            return
        }

        const ids = idsParam.split(',')
        if (ids.length === 0) {
            setLoading(false)
            return
        }

        const fetchOrders = async () => {
            try {
                // Fetch all orders in parallel
                const promises = ids.map(id => getDarazOrderById(id))
                const results = await Promise.all(promises)
                setOrders(results)

                // Mark as printed
                await markDarazOrdersAsPrinted(ids)

                setLoading(false)
            } catch (err) {
                console.error('Error loading bulk invoices:', err)
                setLoading(false)
            }
        }

        fetchOrders()
    }, [idsParam])

    useEffect(() => {
        if (orders.length > 0 && !loading) {
            // Wait for render then print
            setTimeout(() => {
                window.print()
            }, 1000)
        }
    }, [orders, loading])

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

    if (loading) return <div className="p-8 text-center text-xl">Preparing Bulk Invoices...</div>
    if (orders.length === 0) return <div className="p-8 text-center text-red-500">No orders selected or found.</div>

    return (
        <div className="bg-white min-h-screen text-black font-sans">
            <style jsx global>{`
                @media print {
                    @page { 
                        size: A4 portrait;
                        margin: 10mm; /* Safe print margin */
                    }
                    body { 
                        margin: 0;
                        padding: 0;
                        -webkit-print-color-adjust: exact; 
                        width: 100%;
                    }
                    /* Ensure container takes full available width without forcing overflow */
                    .invoice-container {
                        width: 100% !important;
                        max-width: none !important;
                        margin: 0 0 20px 0 !important;
                        border-bottom: 1px dashed #ccc;
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                }
                
                /* Screen styles (preview) */
                .invoice-container { 
                    max-width: 210mm; /* Preview size */
                    margin: 0 auto 20px auto;
                    padding-bottom: 20px;
                    border-bottom: 1px dashed #ccc;
                }

                /* Remove border from last item */
                .invoice-container:last-child { 
                    border-bottom: none; 
                    margin-bottom: 0;
                }
                
                .header-company { font-size: 20px; font-weight: bold; text-align: center; }
                .header-sub { font-size: 14px; text-align: center; margin-top: 2px; }
                .horizontal-line { border-bottom: 2px solid black; margin: 8px 0; }
                .dotted-line { border-bottom: 1px dotted black; margin: 8px 0; width: 100%; }
                .info-row { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 4px; }
                .info-left { text-align: left; }
                .info-right { text-align: right; }
                .invoice-table { width: 100%; border-collapse: collapse; border: 2px solid black; margin-top: 10px; font-size: 14px; }
                .invoice-table th { border: 1px solid black; padding: 4px; text-align: center; font-weight: bold; height: 28px; }
                .invoice-table td { border: 1px solid black; padding: 4px; vertical-align: top; }
                .row-min-height { height: 32px; }
                .footer { text-align: center; font-size: 12px; margin-top: 15px; }
            `}</style>

            {orders.map((order) => {
                const store = order.store
                const totalAmount = order.items?.reduce((sum: number, item: any) => sum + (item.amount * item.quantity), 0) || 0
                const sellerAccount = order.items?.[0]?.seller_account || 'N/A'

                return (
                    <div key={order.id} className="invoice-container">
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
                        <div className="footer" style={{ marginTop: '15px' }}>
                            {order.remarks ? (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '12px' }}>
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
                )
            })}
        </div >
    )
}

export default function BulkInvoicePage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-xl">Loading...</div>}>
            <BulkInvoiceContent />
        </Suspense>
    )
}

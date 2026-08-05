'use client'

import React, { useRef } from 'react'

interface DarazInvoiceProps {
    order: any
    store: {
        company_name: string
        address: string
        contact: string
        pan_vat_number: string
    } | null
    onClose: () => void
}

export function DarazInvoice({ order, store, onClose }: DarazInvoiceProps) {
    const printRef = useRef<HTMLDivElement>(null)

    const handlePrint = () => {
        const printContent = printRef.current?.innerHTML
        const originalContents = document.body.innerHTML

        if (printContent) {
            const printWindow = window.open('', '', 'height=800,width=800')
            if (printWindow) {
                printWindow.document.write('<html><head><title>Print Invoice</title>')
                printWindow.document.write('<style>')
                printWindow.document.write(`
                    body { font-family: sans-serif; padding: 20px; }
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
                    @media print {
                        body { padding: 0; }
                        .no-print { display: none; }
                    }
                `)
                printWindow.document.write('</style></head><body>')
                printWindow.document.write(printContent)
                printWindow.document.write('</body></html>')
                printWindow.document.close()
                printWindow.print()
                printWindow.close()
            }
        }
    }

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

    if (!order) return null

    const totalAmount = order.items?.reduce((sum: number, item: any) => sum + (item.amount * item.quantity), 0) || 0
    // Use seller account from first item for the Info field, but prefer Store Company Name for the Header
    const sellerAccount = order.items?.[0]?.seller_account || 'N/A'

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-[210mm] max-h-[95vh] flex flex-col">
                {/* Modal Header */}
                <div className="flex justify-between items-center p-3 border-b">
                    <h3 className="font-bold text-sm">Invoice Preview</h3>
                    <div className="flex gap-2">
                        <button onClick={handlePrint} className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
                            Print
                        </button>
                        <button onClick={onClose} className="px-3 py-1 bg-gray-200 text-gray-800 text-xs rounded hover:bg-gray-300">
                            Close
                        </button>
                    </div>
                </div>

                {/* Invoice Content (A4 width approx) */}
                <div className="overflow-auto p-8 bg-gray-100 flex justify-center">
                    <div ref={printRef} className="bg-white w-[190mm] min-h-[200mm] p-8 shadow-sm text-black">
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
                        <div className="footer">
                            This is a computer-generated bill. If you find any issue, please contact us.
                            <div className="dotted-line" style={{ marginTop: '5px' }}></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

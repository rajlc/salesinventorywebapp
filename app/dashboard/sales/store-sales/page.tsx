'use client'

import { useState, useEffect } from 'react'
import StoreSalesList from './components/StoreSalesList'
import StoreSalesPos from './components/StoreSalesPos'
import MobileLandscapePrompt from './components/MobileLandscapePrompt'
import Link from 'next/link'
import { ArrowLeft, List, LayoutGrid, X, Pencil } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

export default function StoreSalesPage() {
    const [view, setView] = useState<'POS' | 'LIST'>('POS')
    const [editingSale, setEditingSale] = useState<any>(null)
    const [viewingSaleId, setViewingSaleId] = useState<string | null>(null)
    const [isLandscape, setIsLandscape] = useState(false)

    useEffect(() => {
        const checkOrientation = () => {
            setIsLandscape(window.innerWidth > window.innerHeight && window.innerWidth < 1024)
        }
        checkOrientation()
        window.addEventListener('resize', checkOrientation)
        return () => window.removeEventListener('resize', checkOrientation)
    }, [])

    const handleEditSale = (sale: any) => {
        setEditingSale(sale)
        setView('POS')
        setViewingSaleId(null) // Close view modal if open
    }

    const handleCancelEdit = () => {
        setEditingSale(null)
    }

    return (
        <div className={`flex flex-col h-screen bg-gray-50 dark:bg-zinc-900 transition-all ${isLandscape ? 'overflow-hidden' : ''}`}>
            {/* Header / Global Top Bar */}
            <div className={`sticky top-0 z-30 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 flex items-center justify-between shadow-md transition-all
                ${view === 'POS' ? 'px-2 py-1.5 md:px-4 md:py-3' : 'px-4 py-2 md:py-3'} 
            `}>
                <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto justify-between md:justify-start">
                    <div className="flex items-center gap-2">
                        <h1 className="text-base md:text-xl font-black tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent uppercase cursor-default">
                            {editingSale ? 'Edit Sale' : 'Store POS'}
                        </h1>
                        {isLandscape && <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Landscape</span>}
                    </div>

                    <div className="flex bg-gray-100 dark:bg-zinc-800/80 rounded-lg p-0.5 md:p-1 border dark:border-zinc-700">
                        <button
                            onClick={() => {
                                setView('POS')
                                setEditingSale(null)
                            }}
                            className={`px-2.5 md:px-4 py-1 md:py-1.5 text-xs md:text-sm font-bold rounded-md transition-all duration-200 flex items-center gap-2 ${view === 'POS'
                                ? 'bg-white dark:bg-zinc-700 shadow-sm text-blue-600 dark:text-blue-400'
                                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            <LayoutGrid size={14} className={view === 'POS' ? 'text-blue-600' : ''} />
                            <span className="hidden xs:inline">POS</span>
                        </button>
                        <button
                            onClick={() => {
                                setView('LIST')
                                setEditingSale(null)
                            }}
                            className={`px-2.5 md:px-4 py-1 md:py-1.5 text-xs md:text-sm font-bold rounded-md transition-all duration-200 flex items-center gap-2 ${view === 'LIST'
                                ? 'bg-white dark:bg-zinc-700 shadow-sm text-blue-600 dark:text-blue-400'
                                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            <List size={14} className={view === 'LIST' ? 'text-blue-600' : ''} />
                            <span className="hidden xs:inline">List</span>
                        </button>
                    </div>
                </div>

                <Link
                    href="/dashboard/sales"
                    className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 bg-gray-50 dark:bg-zinc-800 rounded-lg border dark:border-zinc-700 transition-all hover:border-blue-200"
                >
                    <ArrowLeft size={16} />
                    Back
                </Link>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                {isLandscape ? (
                    <div className="flex h-full divide-x dark:divide-zinc-800">
                        {/* Always show List on the left in landscape split */}
                        <div className="w-[35%] min-w-[300px] h-full overflow-hidden border-r dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
                            <StoreSalesList
                                onSwitchToPos={() => { }} // N/A in split
                                onViewSale={(id) => setViewingSaleId(id)}
                            />
                        </div>
                        {/* Always show POS on the right in landscape split */}
                        <div className="flex-1 h-full overflow-hidden">
                            <StoreSalesPos
                                onSwitchToList={() => { }} // N/A in split
                                initialData={editingSale}
                                onCancelEdit={handleCancelEdit}
                            />
                        </div>
                    </div>
                ) : (
                    <>
                        {view === 'POS' ? (
                            <StoreSalesPos
                                onSwitchToList={() => {
                                    setView('LIST')
                                    setEditingSale(null)
                                }}
                                initialData={editingSale}
                                onCancelEdit={handleCancelEdit}
                            />
                        ) : (
                            <StoreSalesList
                                onSwitchToPos={() => {
                                    setView('POS')
                                    setEditingSale(null)
                                }}
                                onViewSale={(id) => setViewingSaleId(id)}
                            />
                        )}
                    </>
                )}
            </div>

            {/* View Modal */}
            {viewingSaleId && (
                <ViewStoreSaleModal
                    saleId={viewingSaleId}
                    onClose={() => setViewingSaleId(null)}
                    onEdit={(sale) => handleEditSale(sale)}
                />
            )}

            <MobileLandscapePrompt />
        </div>
    )
}

// View Store Sale Modal Component
function ViewStoreSaleModal({ saleId, onClose, onEdit }: { saleId: string, onClose: () => void, onEdit: (sale: any) => void }) {
    const { data, isLoading } = useQuery({
        queryKey: ['store-sale', saleId],
        queryFn: async () => {
            const { getStoreSaleById } = await import('@/features/sales/actions/store-sales-actions')
            return getStoreSaleById(saleId)
        }
    })

    const sale = (data as any)?.data

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b dark:border-zinc-800">
                    <h2 className="text-lg font-semibold">Sale Details</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 p-4 space-y-5 overflow-y-auto">
                    {isLoading ? (
                        <div className="text-center py-8 text-gray-500">Loading...</div>
                    ) : sale ? (
                        <>
                            <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                                <div>
                                    <label className="block text-xs text-gray-500 uppercase font-semibold mb-1">Date</label>
                                    <span className="font-medium text-gray-900 dark:text-gray-200">{new Date(sale.sale_date).toLocaleDateString()}</span>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 uppercase font-semibold mb-1">Customer</label>
                                    <span className="font-medium text-gray-900 dark:text-gray-200">{sale.customer_name}</span>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 uppercase font-semibold mb-1">Payment</label>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${sale.payment_type === 'Due'
                                        ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30'
                                        : sale.payment_type === 'Online Payment'
                                            ? 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-900/30'
                                            : 'bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30'
                                        }`}>
                                        {sale.payment_type || 'Cash'}
                                    </span>
                                </div>
                                {sale.remarks && (
                                    <div className="col-span-2">
                                        <label className="block text-xs text-gray-500 uppercase font-semibold mb-1">Remarks</label>
                                        <p className="text-sm bg-gray-50 dark:bg-zinc-800 p-2 rounded border dark:border-zinc-700">{sale.remarks}</p>
                                    </div>
                                )}
                            </div>

                            {/* Items */}
                            <div>
                                <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">Items</h3>
                                <div className="border dark:border-zinc-700 rounded-md overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 dark:bg-zinc-800 text-xs text-gray-500 uppercase">
                                            <tr>
                                                <th className="px-3 py-2 text-left font-medium">Product</th>
                                                <th className="px-3 py-2 text-right font-medium">Qty</th>
                                                <th className="px-3 py-2 text-right font-medium">Amount</th>
                                                <th className="px-3 py-2 text-right font-medium">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-700">
                                            {sale.items?.map((item: any, index: number) => (
                                                <tr key={index}>
                                                    <td className="px-3 py-2 font-medium">{item.product_name}</td>
                                                    <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">{item.qty}</td>
                                                    <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">Rs. {item.amount?.toLocaleString()}</td>
                                                    <td className="px-3 py-2 text-right font-medium">Rs. {(item.qty * (item.amount || 0)).toLocaleString()}</td>
                                                </tr>
                                            ))}
                                            <tr className="bg-gray-50 dark:bg-zinc-800 font-bold border-t-2 border-gray-100 dark:border-zinc-700">
                                                <td className="px-3 py-2" colSpan={3}>Grand Total</td>
                                                <td className="px-3 py-2 text-right text-blue-600 dark:text-blue-400">Rs. {sale.total_amount?.toLocaleString()}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-8 text-gray-500">Sale not found</div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-3 border-t dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50">
                    <button
                        onClick={() => onEdit(sale)}
                        disabled={!sale}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm disabled:opacity-50"
                    >
                        <Pencil size={14} />
                        Edit Sale
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm border dark:border-zinc-700 rounded-md hover:bg-white dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-300"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}

// View Store Sale Modal Component


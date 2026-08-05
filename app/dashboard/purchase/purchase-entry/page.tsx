'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getTodayPurchases, Purchase } from '@/features/purchase/actions/purchase-actions'
import { getActiveFiscalYear } from '@/features/purchase/actions/purchase-analytics-actions'
import { Plus, List, Search, ArrowLeft, Info, Edit2, History, FileStack, X, LayoutDashboard } from 'lucide-react'
import Link from 'next/link'
import PurchaseForm from '@/features/purchase/components/PurchaseForm'
import { Card } from '@/components/ui-shim'
import DailyPurchaseDetailView from '@/features/purchase/components/DailyPurchaseDetailView'
import { PermissionGuard } from '@/components/permissions/PermissionGuard'
import { usePermissions } from '@/lib/permissions/PermissionContext'

export default function PurchaseEntryPage() {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null)
    const [viewingPurchase, setViewingPurchase] = useState<Purchase | null>(null)
    const [search, setSearch] = useState('')
    const { userRole } = usePermissions()
    const isNewUser = userRole === 'new_user'
    const isRestricted = userRole === 'user' || userRole === 'new_user'

    // View Mode State
    const [viewMode, setViewMode] = useState<'entry' | 'transactions'>('entry')

    // Date formatter for DD/MM
    const formatDateDDMM = (dateStr: string) => {
        if (!dateStr) return ''
        const date = new Date(dateStr)
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`
    }

    // Fetch Today's Purchases
    const { data, isLoading } = useQuery({
        queryKey: ['today-purchases'],
        queryFn: getTodayPurchases
    })

    // Fetch Active Fiscal Year
    const { data: fiscalYearData } = useQuery({
        queryKey: ['active-fiscal-year'],
        queryFn: getActiveFiscalYear
    })

    const activeFY = fiscalYearData?.data

    const filteredPurchases = data?.purchases.filter((p: Purchase) =>
        p.product?.product_name.toLowerCase().includes(search.toLowerCase()) ||
        p.supplier?.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
        p.remarks?.toLowerCase().includes(search.toLowerCase())
    ) || []

    return (
        <PermissionGuard mainRole="Purchase" subRole="Purchase Entry">
            <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900">
            {/* Header - Hidden on mobile */}
            <div className="hidden md:flex sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 items-center justify-between shadow-sm">
                <div>
                    <h1 className="text-[17px] font-bold">Purchase Entry</h1>
                    <p className="text-[13px] text-gray-500 dark:text-gray-400">Add and view today&apos;s purchases</p>
                </div>
                <Link
                    href="/dashboard/purchase"
                    className="flex items-center gap-1 px-2 py-1 text-[13px] text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-zinc-800 rounded transition-colors"
                >
                    <ArrowLeft size={14} />
                    Back to Dashboard
                </Link>
            </div>

            {/* Action Bar */}
            <div className="sticky top-0 md:top-[44px] z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-2 shadow-sm flex flex-wrap items-center justify-between gap-4">

                {/* View Toggle */}
                <div className="flex p-0.5 bg-gray-100 dark:bg-zinc-800 rounded-lg shrink-0">
                    <button
                        onClick={() => setViewMode('entry')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'entry'
                            ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        Purchase Entry
                    </button>
                    {!isRestricted && (
                        <button
                            onClick={() => setViewMode('transactions')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'transactions'
                                ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            Transaction Details
                        </button>
                    )}
                </div>

                {/* Left: Search (Only in Entry Mode) */}
                {viewMode === 'entry' && (
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-sm border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800"
                        />
                    </div>
                )}


                {/* Right: Buttons */}
                <div className="flex items-center gap-2 w-full md:w-auto justify-end ml-auto">
                    {/* Add Button - Hidden on mobile (Only in Entry Mode) */}
                    {viewMode === 'entry' && !isNewUser && (
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="hidden md:flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors whitespace-nowrap"
                        >
                            <Plus size={16} />
                            Add Purchase
                        </button>
                    )}

                    {!isNewUser && (
                        <Link
                            href="/dashboard/purchase/dashboard"
                            className="hidden md:flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50 rounded transition-colors whitespace-nowrap"
                        >
                            <LayoutDashboard size={16} />
                            Purchase Summary
                        </Link>
                    )}
                </div>
            </div>

            {/* Content Switcher */}
            {viewMode === 'entry' ? (
                // Existing Entry View
                <div className="flex-1 overflow-auto px-3 pt-1 pb-20 md:p-3">
                    {/* Desktop view */}
                    <div className="hidden md:block">
                        <Card className="overflow-hidden bg-white shadow-sm dark:bg-zinc-900 border">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 dark:bg-zinc-800">
                                        <tr>
                                            <th className="px-3 py-2 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Date</th>
                                            <th className="px-3 py-2 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Product</th>
                                            {!isNewUser && <th className="px-3 py-2 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Supplier</th>}
                                            <th className="px-3 py-2 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-right">Qty</th>
                                            {!isRestricted && <th className="px-3 py-2 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-right">Rate</th>}
                                            {!isRestricted && <th className="px-3 py-2 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-right">Total</th>}
                                            {!isNewUser && <th className="px-3 py-2 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Type</th>}
                                            <th className="px-3 py-2 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Remarks</th>
                                            {!isNewUser && <th className="px-3 py-2 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-center">Actions</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                        {isLoading ? (
                                            <tr><td colSpan={9} className="p-4 text-center text-sm text-gray-500">Loading...</td></tr>
                                        ) : filteredPurchases.length === 0 ? (
                                            <tr><td colSpan={9} className="p-4 text-center text-sm text-gray-500">No purchases added today.</td></tr>
                                        ) : (
                                            filteredPurchases.map((purchase: Purchase) => (
                                                <tr key={purchase.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                                    <td className="px-3 py-2 text-sm">{purchase.purchase_date}</td>
                                                    <td className="px-3 py-2 text-sm font-medium">
                                                        <div>{purchase.product?.product_name}</div>
                                                        {!isNewUser && (
                                                            <div className="flex justify-center mt-1">
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wide ${(purchase.purchase_type === 'Sell')
                                                                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                                    }`}>
                                                                    {purchase.purchase_type || 'Buy'}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </td>
                                                    {!isNewUser && <td className="px-3 py-2 text-sm">{purchase.supplier?.supplier_name}</td>}
                                                    <td className="px-3 py-2 text-sm text-right">{purchase.quantity}</td>
                                                    {!isRestricted && <td className="px-3 py-2 text-sm text-right">{purchase.unit_amount.toLocaleString()}</td>}
                                                    {!isRestricted && <td className="px-3 py-2 text-sm text-right font-medium text-green-600">Rs {purchase.total_amount.toLocaleString()}</td>}
                                                    {!isNewUser && (
                                                        <td className="px-3 py-2 text-sm">
                                                            <span className={`px-2 py-0.5 rounded textxs font-medium ${purchase.payment_type === 'Due' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                                                                }`}>
                                                                {purchase.payment_type}
                                                            </span>
                                                        </td>
                                                    )}
                                                    <td className="px-3 py-2 text-sm text-gray-500 truncate max-w-[200px]" title={purchase.remarks}>{purchase.remarks}</td>
                                                    {!isNewUser && (
                                                        <td className="px-3 py-2 text-center">
                                                            <button
                                                                onClick={() => setEditingPurchase(purchase)}
                                                                className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-zinc-800 rounded transition-colors"
                                                                title="Edit Purchase"
                                                            >
                                                                <Edit2 size={16} />
                                                            </button>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-3">
                        {isLoading ? (
                            <div className="text-center p-4 text-gray-500">Loading...</div>
                        ) : filteredPurchases.length === 0 ? (
                            <div className="text-center p-4 text-gray-500">No purchases added today.</div>
                        ) : (
                            filteredPurchases.map((purchase: Purchase) => (
                                <div key={purchase.id} className="bg-white dark:bg-zinc-900 p-3 rounded-lg border shadow-sm flex flex-col gap-2">
                                    {/* Row 1: Date | Qty */}
                                    <div className="flex justify-between items-center text-xs text-gray-500 border-b border-dashed pb-2">
                                        <div>{formatDateDDMM(purchase.purchase_date)}</div>
                                        <div>Qty: <span className="font-bold text-gray-900 dark:text-gray-200">{purchase.quantity}</span></div>
                                    </div>

                                    {/* Row 2: Product Name (Clickable) */}
                                    <div
                                        onClick={() => setViewingPurchase(purchase)}
                                        className="font-medium text-blue-600 dark:text-blue-400 py-1 cursor-pointer"
                                    >
                                        <div>{purchase.product?.product_name}</div>
                                        <div className="flex mt-1">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wide ${(purchase.purchase_type === 'Sell')
                                                ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                }`}>
                                                {purchase.purchase_type || 'Buy'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Row 3: Supplier | Payment Type */}
                                    {!isNewUser && (
                                        <div className="flex justify-between items-center text-xs">
                                            <div className="text-gray-600 dark:text-gray-300 truncate max-w-[60%]">{purchase.supplier?.supplier_name}</div>
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${purchase.payment_type === 'Due' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                {purchase.payment_type}
                                            </span>
                                        </div>
                                    )}

                                    {/* Row 4: Amounts (Rate top, Total bottom) */}
                                    {!isRestricted && (
                                        <div className="flex justify-between items-end border-t border-dashed pt-2 mt-1">
                                            <div className="text-xs text-gray-500">
                                                Rate: {purchase.unit_amount.toLocaleString()}
                                            </div>
                                            <div className="font-bold text-green-600 dark:text-green-400">
                                                Rs {purchase.total_amount.toLocaleString()}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            ) : (
                // Transaction Details View
                <DailyPurchaseDetailView
                    date={new Date().toISOString()} // Today
                    purchases={data?.purchases || []}
                    isLoading={isLoading}
                />
            )}



            {/* Add Purchase Modal */}
            {
                isAddModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 md:p-4">
                        <div className="w-full max-w-3xl h-full md:h-[80vh] bg-white dark:bg-zinc-900 md:rounded-lg shadow-xl overflow-hidden">
                            <PurchaseForm
                                onClose={() => setIsAddModalOpen(false)}
                                onSuccess={() => { }}
                            />
                        </div>
                    </div>
                )
            }

            {/* Edit Purchase Modal */}
            {
                editingPurchase && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 md:p-4">
                        <div className="w-full max-w-3xl h-full md:h-[80vh] bg-white dark:bg-zinc-900 md:rounded-lg shadow-xl overflow-hidden">
                            <PurchaseForm
                                editMode={true}
                                purchaseData={editingPurchase}
                                onClose={() => setEditingPurchase(null)}
                                onSuccess={() => { }}
                            />
                        </div>
                    </div>
                )
            }

            {/* View Purchase Modal */}
            {
                viewingPurchase && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                        onClick={(e) => {
                            if (e.target === e.currentTarget) {
                                setViewingPurchase(null)
                            }
                        }}
                    >
                        <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
                            {/* Header */}
                            <div className="px-4 py-3 border-b dark:border-zinc-800 flex justify-between items-center bg-gray-50 dark:bg-zinc-800/50">
                                <h3 className="font-medium text-gray-900 dark:text-gray-100">Purchase Details</h3>
                                <button
                                    onClick={() => setViewingPurchase(null)}
                                    className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-500 transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-4 space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-500 uppercase">Product</label>
                                    <div className="text-base font-medium text-gray-900 dark:text-gray-100">{viewingPurchase?.product?.product_name}</div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-500 uppercase">Date</label>
                                        <div className="text-sm">{viewingPurchase?.purchase_date}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-500 uppercase">Quantity</label>
                                        <div className="text-sm font-semibold">{viewingPurchase?.quantity}</div>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-500 uppercase">Supplier</label>
                                    <div className="text-sm">{viewingPurchase?.supplier?.supplier_name}</div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-500 uppercase">Rate</label>
                                        <div className="text-sm">{viewingPurchase?.unit_amount?.toLocaleString()}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-500 uppercase">Total Amount</label>
                                        <div className="text-sm font-bold text-green-600 dark:text-green-400">
                                            Rs {viewingPurchase?.total_amount?.toLocaleString()}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-500 uppercase">Payment Type</label>
                                    <div>
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${viewingPurchase?.payment_type === 'Due'
                                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                            }`}>
                                            {viewingPurchase?.payment_type}
                                        </span>
                                    </div>
                                </div>

                                {viewingPurchase?.remarks && (
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-500 uppercase">Remarks</label>
                                        <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-zinc-800 p-2 rounded">
                                            {viewingPurchase?.remarks}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-4 py-3 border-t dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 flex justify-end">
                                <button
                                    onClick={() => {
                                        setEditingPurchase(viewingPurchase)
                                        setViewingPurchase(null)
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                                >
                                    <Edit2 size={16} />
                                    Edit Purchase
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Mobile Footer Navigation */}
            {!isNewUser && (
                <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t dark:border-zinc-800 p-2 grid grid-cols-1 gap-2 z-40">
                    <Link
                        href="/dashboard/purchase/dashboard"
                        className="flex flex-col items-center justify-center p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 active:scale-95 transition-transform"
                    >
                        <LayoutDashboard size={20} className="mb-1" />
                        <span className="text-[10px] font-medium text-center leading-tight">Purchase<br />Summary</span>
                    </Link>
                </div>
            )}
        </div >
        </PermissionGuard>
    )
}

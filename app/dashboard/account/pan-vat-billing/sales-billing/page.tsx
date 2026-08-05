'use client'

import { ArrowLeft, Plus } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { StockAnalysisPage } from '@/features/stock-analysis/components/StockAnalysisPage'
import { AddSalesBillModal } from '@/features/sales/components/AddSalesBillModal'
import { SalesBillList } from '@/features/sales/components/SalesBillList'
import { SalesBillDetailModal } from '@/features/sales/components/SalesBillDetailModal'
import { SalesBill } from '@/features/sales/actions/sales-bill-actions'
import { SalesAnalysisPage } from '@/features/sales/components/SalesAnalysisPage'

export default function SalesBillingPage() {
    const [activeTab, setActiveTab] = useState<'bill-entry' | 'stock-analysis' | 'sales-analysis'>('bill-entry')
    const [isAddSalesBillModalOpen, setIsAddSalesBillModalOpen] = useState(false)
    const [selectedBillId, setSelectedBillId] = useState<string | null>(null)
    const [galleryBillIds, setGalleryBillIds] = useState<string[] | undefined>(undefined)
    const [billToEdit, setBillToEdit] = useState<SalesBill | undefined>(undefined)

    const handleEditBill = (bill: SalesBill) => {
        setSelectedBillId(null)
        setGalleryBillIds(undefined)
        setBillToEdit(bill)
        setIsAddSalesBillModalOpen(true)
    }

    const handleCloseAddModal = () => {
        setIsAddSalesBillModalOpen(false)
        setBillToEdit(undefined)
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900">
            {/* Header */}
            <div className="hidden md:flex sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 items-center justify-between shadow-sm">
                <div>
                    <h1 className="text-[17px] font-bold">Sales Billing</h1>
                    <p className="text-[13px] text-gray-500 dark:text-gray-400">Manage sales invoices and details</p>
                </div>
                <div className="flex gap-2">
                    <Link
                        href="/dashboard/account/pan-vat-billing"
                        className="flex items-center gap-1 px-2 py-1 text-[13px] bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors"
                    >
                        <ArrowLeft size={12} />
                        Back
                    </Link>
                </div>
            </div>

            {/* Tab Bar */}
            <div className="hidden md:flex sticky top-[44px] z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 shadow-sm items-center justify-between gap-4">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setActiveTab('bill-entry')}
                        className={`flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors ${activeTab === 'bill-entry'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                            }`}
                    >
                        Bill Entry
                    </button>
                    <button
                        onClick={() => setActiveTab('stock-analysis')}
                        className={`flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors ${activeTab === 'stock-analysis'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                            }`}
                    >
                        Stock Analysis
                    </button>
                    <button
                        onClick={() => setActiveTab('sales-analysis')}
                        className={`flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors ${activeTab === 'sales-analysis'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                            }`}
                    >
                        Sales Analysis
                    </button>
                </div>

                {/* Add Buttons */}
                <div className="flex items-center gap-2">
                    {activeTab === 'bill-entry' && (
                        <button
                            onClick={() => {
                                setBillToEdit(undefined)
                                setIsAddSalesBillModalOpen(true)
                            }}
                            className="flex items-center gap-1 px-2 py-1 text-[13px] bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors whitespace-nowrap"
                        >
                            <Plus size={14} />
                            Add Sales Bill
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-3">
                {activeTab === 'bill-entry' ? (
                    <SalesBillList
                        onViewBill={(id, ids) => {
                            setSelectedBillId(id)
                            setGalleryBillIds(ids)
                        }}
                    />
                ) : activeTab === 'stock-analysis' ? (
                    <StockAnalysisPage />
                ) : (
                    <SalesAnalysisPage />
                )}
            </div>

            {/* Modals */}
            {isAddSalesBillModalOpen && (
                <AddSalesBillModal
                    onClose={handleCloseAddModal}
                    billToEdit={billToEdit}
                />
            )}

            {selectedBillId && (
                <SalesBillDetailModal
                    billId={selectedBillId}
                    galleryBillIds={galleryBillIds}
                    onClose={() => {
                        setSelectedBillId(null)
                        setGalleryBillIds(undefined)
                    }}
                    onEdit={handleEditBill}
                    onNavigateBill={setSelectedBillId}
                />
            )}
        </div>
    )
}

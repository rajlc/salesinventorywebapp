'use client'

import { ArrowLeft, FileText, Users, Building, BarChart3, Plus, Edit } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { AddPanVatCompanyModal } from '@/features/account/components/AddPanVatCompanyModal'
import { AddPanVatBillModal } from '@/features/account/components/AddPanVatBillModal'
import { PanVatBillList } from '@/features/account/components/PanVatBillList'
import { getPanVatCompanies, type PanVatCompany } from '@/features/account/actions/pan-vat-company-actions'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { PartiesStatement } from '@/features/account/components/PartiesStatement'
import { PurchaseBillingReport } from '@/features/account/components/PurchaseBillingReport'
import { Card } from '@/components/ui-shim'

type TabType = 'pan-vat-bill' | 'parties-statement' | 'pan-vat-company' | 'report'

export default function PurchaseBillingPage() {
    const [activeTab, setActiveTab] = useState<TabType>('pan-vat-bill')
    const [isAddCompanyModalOpen, setIsAddCompanyModalOpen] = useState(false)
    const [editingCompany, setEditingCompany] = useState<PanVatCompany | null>(null)
    const [isAddBillModalOpen, setIsAddBillModalOpen] = useState(false)
    const queryClient = useQueryClient()

    // Fetch Pan/Vat Companies
    const { data: companies = [], isLoading } = useQuery({
        queryKey: ['pan-vat-companies'],
        queryFn: getPanVatCompanies,
    })

    const handleEdit = (company: PanVatCompany) => {
        setEditingCompany(company)
        setIsAddCompanyModalOpen(true)
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-2 flex items-center justify-between shadow-sm">
                <div>
                    <h1 className="text-[17px] font-bold">Purchase Billing</h1>
                    <p className="text-[13px] text-gray-500 dark:text-gray-400 hidden md:block">Manage purchase invoices and details</p>
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
            <div className="sticky top-[50px] z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 shadow-sm flex items-center justify-between gap-4 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setActiveTab('pan-vat-bill')}
                        className={`flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors ${activeTab === 'pan-vat-bill'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                            }`}
                    >
                        <FileText size={12} />
                        Purchase Book
                    </button>
                    <button
                        onClick={() => setActiveTab('parties-statement')}
                        className={`flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors ${activeTab === 'parties-statement'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                            }`}
                    >
                        <Users size={12} />
                        Parties Statement
                    </button>
                    <button
                        onClick={() => setActiveTab('pan-vat-company')}
                        className={`flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors ${activeTab === 'pan-vat-company'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                            }`}
                    >
                        <Building size={12} />
                        Pan/Vat Company
                    </button>
                    <button
                        onClick={() => setActiveTab('report')}
                        className={`flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors ${activeTab === 'report'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                            }`}
                    >
                        <BarChart3 size={12} />
                        Report
                    </button>
                </div>

                {/* Add Buttons */}
                <div className="flex items-center gap-2">
                    {activeTab === 'pan-vat-bill' && (
                        <button
                            onClick={() => setIsAddBillModalOpen(true)}
                            className="flex items-center gap-1 px-2 py-1 text-[13px] bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors whitespace-nowrap"
                        >
                            <Plus size={14} />
                            Add Bill
                        </button>
                    )}
                    {activeTab === 'pan-vat-company' && (
                        <button
                            onClick={() => setIsAddCompanyModalOpen(true)}
                            className="flex items-center gap-1 px-2 py-1 text-[13px] bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors whitespace-nowrap"
                        >
                            <Plus size={14} />
                            Add Company
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-3">
                {activeTab === 'pan-vat-bill' ? (
                    <PanVatBillList onAddBill={() => setIsAddBillModalOpen(true)} />
                ) : activeTab === 'parties-statement' ? (
                    <PartiesStatement />
                ) : activeTab === 'pan-vat-company' ? (
                    <Card className="overflow-hidden">
                        {/* Table Header */}
                        <div className="p-3 border-b dark:border-zinc-800">
                            <h2 className="text-[15px] font-semibold">Pan/Vat Companies</h2>
                            <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1">
                                Total: {companies.length} {companies.length === 1 ? 'company' : 'companies'}
                            </p>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 dark:bg-zinc-800">
                                    <tr>
                                        <th className="px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Company Name
                                        </th>
                                        <th className="px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Pan/Vat No
                                        </th>
                                        <th className="px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Supplier Name
                                        </th>
                                        <th className="px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Remarks
                                        </th>
                                        <th className="px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Created At
                                        </th>
                                        <th className="px-3 py-2 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-800">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={6} className="px-3 py-8 text-center text-gray-500 text-[13px]">
                                                Loading companies...
                                            </td>
                                        </tr>
                                    ) : companies.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-3 py-8 text-center text-gray-500 text-[13px]">
                                                No companies found. Click "Add Company" to create one.
                                            </td>
                                        </tr>
                                    ) : (
                                        companies.map((company) => (
                                            <tr key={company.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                                <td className="px-3 py-2 whitespace-nowrap">
                                                    <div className="text-[13px] font-medium text-gray-900 dark:text-gray-100">
                                                        {company.company_name}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap">
                                                    <div className="text-[13px] text-gray-900 dark:text-gray-100">
                                                        {company.pan_vat_no}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap">
                                                    <div className="text-[13px] text-gray-900 dark:text-gray-100">
                                                        {company.supplier_name || '-'}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="text-[13px] text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                                        {company.remarks || '-'}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap">
                                                    <div className="text-[13px] text-gray-500 dark:text-gray-400">
                                                        {format(new Date(company.created_at), 'MMM dd, yyyy')}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-right">
                                                    <button
                                                        onClick={() => handleEdit(company)}
                                                        className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                                                        title="Edit company"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                ) : (
                    <PurchaseBillingReport />
                )}
            </div>

            {/* Add/Edit Company Modal */}
            <AddPanVatCompanyModal
                isOpen={isAddCompanyModalOpen}
                onClose={() => {
                    setIsAddCompanyModalOpen(false)
                    setEditingCompany(null)
                }}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['pan-vat-companies'] })
                }}
                company={editingCompany}
            />

            {/* Add Bill Modal */}
            {isAddBillModalOpen && (
                <AddPanVatBillModal
                    onClose={() => setIsAddBillModalOpen(false)}
                />
            )}
        </div>
    )
}

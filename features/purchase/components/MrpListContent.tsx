'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Plus, Search, Calendar, Package } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'
import { getAllMrpPrices, addMrpPrice } from '@/features/purchase/actions/mrp-actions'
import { getAllProductOptions } from '@/features/inventory/actions/product-actions'

interface MrpListContentProps {
    isEmbedded?: boolean
}

export default function MrpListContent({ isEmbedded = false }: MrpListContentProps) {
    const [search, setSearch] = useState('')
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)

    const { data: mrpResponse, isLoading, refetch } = useQuery({
        queryKey: ['mrp-prices'],
        queryFn: getAllMrpPrices
    })

    const mrpData = mrpResponse?.data || []

    const filteredMrp = mrpData.filter((item) =>
        item.product_name.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className={`flex flex-col h-full bg-gray-50 dark:bg-zinc-900 ${isEmbedded ? '' : 'p-4'}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">MRP List</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Manage Maximum Retail Prices</p>
                </div>
                <div className="flex items-center gap-2">
                    {!isEmbedded && (
                        <Link
                            href="/dashboard/purchase"
                            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                        >
                            <ArrowLeft size={16} />
                            Back
                        </Link>
                    )}
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors shadow-sm"
                    >
                        <Plus size={16} />
                        Add MRP
                    </button>
                </div>
            </div>

            {/* Content */}
            <Card className="flex-1 bg-white dark:bg-zinc-900 border overflow-hidden flex flex-col">
                <div className="p-3 border-b dark:border-zinc-800 flex items-center gap-2">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search product name..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-sm border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-emerald-500 dark:bg-zinc-800 outline-none"
                        />
                    </div>
                </div>
                
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-zinc-800 sticky top-0 border-b dark:border-zinc-700">
                            <tr>
                                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Applied Date</th>
                                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product Name</th>
                                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">MRP Price</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={3} className="p-8 text-center text-gray-500">Loading...</td>
                                </tr>
                            ) : filteredMrp.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="p-8 text-center text-gray-500">No MRP records found.</td>
                                </tr>
                            ) : (
                                filteredMrp.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                        <td className="px-4 py-3 text-sm">{item.applied_date}</td>
                                        <td className="px-4 py-3 text-sm font-medium">{item.product_name}</td>
                                        <td className="px-4 py-3 text-sm text-right font-bold text-emerald-600 dark:text-emerald-400">
                                            Rs {item.mrp_price.toLocaleString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Add MRP Modal */}
            {isAddModalOpen && (
                <AddMrpModal 
                    onClose={() => setIsAddModalOpen(false)} 
                    onSuccess={() => { refetch(); setIsAddModalOpen(false) }} 
                />
            )}
        </div>
    )
}

function AddMrpModal({ onClose, onSuccess, initialProductName = '' }: { onClose: () => void, onSuccess: () => void, initialProductName?: string }) {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [productName, setProductName] = useState(initialProductName)
    const [mrpPrice, setMrpPrice] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [searchTerm, setSearchTerm] = useState(initialProductName)
    const [showDropdown, setShowDropdown] = useState(false)

    // Fetch products for searchable dropdown
    const { data: inventoryData } = useQuery({
        queryKey: ['inventory-products'],
        queryFn: getAllProductOptions
    })
    
    const products = (inventoryData as any[]) || []
    const filteredProducts = products.filter((p: any) => p.product_name.toLowerCase().includes(searchTerm.toLowerCase()))

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!productName || !mrpPrice || !date) return
        
        setIsSaving(true)
        const res = await addMrpPrice({
            product_name: productName,
            mrp_price: parseFloat(mrpPrice),
            applied_date: date
        })
        setIsSaving(false)
        
        if (res.success) {
            onSuccess()
        } else {
            alert('Failed to save MRP: ' + res.message)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-black dark:text-white">
                <div className="px-5 py-4 border-b dark:border-zinc-800 flex justify-between items-center bg-gray-50 dark:bg-zinc-800/50">
                    <h3 className="font-bold text-lg">Add MRP</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">&times;</button>
                </div>
                
                <form onSubmit={handleSave} className="p-5 space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <Calendar size={14} className="text-emerald-500" />
                            Applied Date
                        </label>
                        <input
                            type="date"
                            required
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            className="w-full px-3 py-2 border dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-zinc-800 outline-none text-black dark:text-white bg-white"
                        />
                    </div>

                    <div className="space-y-1.5 relative">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <Package size={14} className="text-emerald-500" />
                            Product Name
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="Search product..."
                            value={searchTerm}
                            onChange={e => {
                                setSearchTerm(e.target.value)
                                setProductName(e.target.value) // fallback to free text if they don't select
                                setShowDropdown(true)
                            }}
                            onFocus={() => setShowDropdown(true)}
                            className="w-full px-3 py-2 border dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-zinc-800 outline-none text-black dark:text-white bg-white"
                        />
                        {showDropdown && filteredProducts.length > 0 && (
                            <ul className="absolute z-10 w-full mt-1 max-h-48 overflow-auto bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded-lg shadow-lg">
                                {filteredProducts.map((p: any) => (
                                    <li 
                                        key={p.id}
                                        onClick={() => {
                                            setProductName(p.product_name)
                                            setSearchTerm(p.product_name)
                                            setShowDropdown(false)
                                        }}
                                        className="px-3 py-2 text-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/20 cursor-pointer border-b dark:border-zinc-700 last:border-0 text-black dark:text-white"
                                    >
                                        {p.product_name}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <span className="text-emerald-500 font-bold">Rs</span>
                            MRP Price
                        </label>
                        <input
                            type="number"
                            required
                            min="0"
                            step="0.01"
                            value={mrpPrice}
                            onChange={e => setMrpPrice(e.target.value)}
                            placeholder="0.00"
                            className="w-full px-3 py-2 border dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-zinc-800 outline-none text-black dark:text-white bg-white"
                        />
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                            {isSaving ? 'Saving...' : 'Save MRP'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

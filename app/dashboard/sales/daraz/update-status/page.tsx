'use client'

import { useState, useRef, useEffect } from 'react'
import { ArrowLeft, Search, Upload, Camera, Check, X } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'
import { toast } from 'sonner'
import { updateDarazOrderStatus } from '@/features/sales/actions/daraz-actions'
import { supabase } from '@/lib/supabase/client'
import { BarcodeScannerModal } from '@/components/BarcodeScannerModal'


// Sound feedback
const playSuccessSound = () => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OXSQ0PVqzn77BgGAc+ltrywnMjBSqAzvLYiTgIGWi78OifTRAOUKfk8LZiHAY4kdfyyHotBSN3x/DdkEMKFF603vClUxQIRp/g8r5sIQUxh9Hy04IzBx1uwO/jl0kNEFWs5++wXxgHP5XY8sBzIwUqgc7y2Ik4CBlouvDon00QDlCn5PC1YhwGOJDX8shzLAUhd8fw3ZBDChRftd7wpVMUCEef4PK+bSEFMYfR8tKDMwcdcL/v4pdJDRBVq+fvsF8YBz+V2PLAcyMFKoHO8tiJOQgZZ7rw6J9NEA5QqOTwtWIbBjiQ1/LIciwFIXfH8N2RQwoUX7Xe8KVTEwhHn+Dyvn0hBTGH0fLSgzMHHW++7+OXSQwQVavm77BfGAc/ldizzwAA')
    audio.play().catch(() => { })
}

const playErrorSound = () => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAAB/fn+Ag4WJjZGUmJqdoqanq6+0uLy/w8bKztHU19re4ePm6Onr7O3u7/Dw8fHx8fHw8O/u7ezq6ejm5OLf3dvatrinpqSioZ+enJuZmJaVk5KRj46NjYuKiYiHhoWEg4KBgICD')
    audio.play().catch(() => { })
}

interface OrderInList {
    id: string
    order_number: string
    tracking_number: string
    product_name: string
    order_status: string
}

export default function UpdateOrderStatusPage() {
    const [searchByField, setSearchByField] = useState('order_number')
    const [searchValue, setSearchValue] = useState('')
    const [ordersInList, setOrdersInList] = useState<OrderInList[]>([])
    const [newStatus, setNewStatus] = useState('')
    const [isUpdating, setIsUpdating] = useState(false)
    const [isCameraOpen, setIsCameraOpen] = useState(false)
    const searchInputRef = useRef<HTMLInputElement>(null)

    // Auto-focus search input on mount
    useEffect(() => {
        searchInputRef.current?.focus()
    }, [])

    // Search and add order to list
    const handleAddToList = async (overrideValue?: string) => {
        const term = overrideValue || searchValue
        if (!term.trim()) {
            toast.error('Please enter a value to search')
            return false // Return false for scanner
        }

        try {
            const searchField = searchByField === 'order_number' ? 'order_number' : 'tracking_number'

            const { data, error } = await supabase
                .from('daraz_orders')
                .select(`
                    id,
                    order_number,
                    tracking_number,
                    order_status,
                    items:daraz_order_items(
                        product_name
                    )
                `)
                .eq(searchField, term.trim())
                .single()

            if (error || !data) {
                playErrorSound()
                toast.error('Order not found')
                if (!overrideValue) setSearchValue('') // Clear only if manual
                searchInputRef.current?.focus()
                return false
            }

            // Check if already in list
            if (ordersInList.some(o => o.id === data.id)) {
                playErrorSound()
                toast.error('Order already in list')
                if (!overrideValue) setSearchValue('')
                searchInputRef.current?.focus()
                return true // Return true because it technically exists/found
            }

            // Add to list
            const newOrder: OrderInList = {
                id: data.id,
                order_number: data.order_number,
                tracking_number: data.tracking_number,
                product_name: (data.items as any[])?.[0]?.product_name || 'N/A',
                order_status: data.order_status
            }

            setOrdersInList(prev => [...prev, newOrder])
            playSuccessSound()
            toast.success('Order added to list')
            setSearchValue('')
            searchInputRef.current?.focus()
            return true
        } catch (error: any) {
            playErrorSound()
            toast.error(error.message || 'Failed to search order')
            if (!overrideValue) setSearchValue('')
            searchInputRef.current?.focus()
            return false
        }
    }

    // Remove order from list
    const handleRemoveFromList = (orderId: string) => {
        setOrdersInList(ordersInList.filter(o => o.id !== orderId))
    }

    // Bulk update status
    const handleBulkUpdate = async () => {
        if (ordersInList.length === 0) {
            toast.error('No orders in list')
            return
        }

        if (!newStatus) {
            toast.error('Please select a new status')
            return
        }

        if (!confirm(`Update ${ordersInList.length} orders to "${newStatus}"?`)) {
            return
        }

        setIsUpdating(true)

        try {
            const orderIds = ordersInList.map(o => o.id)
            await updateDarazOrderStatus(orderIds, newStatus)

            playSuccessSound()
            toast.success(`${ordersInList.length} orders successfully updated`)
            setOrdersInList([])
            setNewStatus('')
        } catch (error: any) {
            playErrorSound()
            toast.error(error.message || 'Failed to update orders')
        } finally {
            setIsUpdating(false)
        }
    }

    // Handle Enter key for scanner
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            handleAddToList()
        }
    }

    // CSV Import
    const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const text = await file.text()
        const lines = text.split('\n').filter(line => line.trim())

        if (lines.length === 0) {
            toast.error('Empty CSV file')
            return
        }

        const headers = lines[0].split(',').map(h => h.trim())
        let searchField = ''

        if (headers.includes('Order Number')) {
            searchField = 'order_number'
        } else if (headers.includes('Tracking Number')) {
            searchField = 'tracking_number'
        } else {
            toast.error('CSV must have "Order Number" or "Tracking Number" header')
            return
        }

        const fieldIndex = headers.indexOf(searchField === 'order_number' ? 'Order Number' : 'Tracking Number')
        let successCount = 0
        let errorCount = 0

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',')
            const searchValue = values[fieldIndex]?.trim()

            if (!searchValue) continue

            try {
                const { data, error } = await supabase
                    .from('daraz_orders')
                    .select(`
                        id,
                        order_number,
                        tracking_number,
                        order_status,
                        items:daraz_order_items(
                            product_name
                        )
                    `)
                    .eq(searchField, searchValue)
                    .single()

                if (error || !data || ordersInList.some(o => o.id === data.id)) {
                    errorCount++
                    continue
                }

                const newOrder: OrderInList = {
                    id: data.id,
                    order_number: data.order_number,
                    tracking_number: data.tracking_number,
                    product_name: (data.items as any[])?.[0]?.product_name || 'N/A',
                    order_status: data.order_status
                }

                setOrdersInList(prev => [...prev, newOrder])
                successCount++
            } catch {
                errorCount++
            }
        }

        toast.success(`Imported ${successCount} orders. ${errorCount} errors.`)
        e.target.value = ''
    }

    // Handle barcode scan
    const handleBarcodeScan = async (barcode: string): Promise<boolean> => {
        // Set search value for visual feedback
        setSearchValue(barcode)
        // Try to add to list
        return await handleAddToList(barcode)
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900 pt-16 md:pt-0">
            {/* Compact Header - Hidden on mobile, visible on desktop */}
            <div className="hidden md:flex sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 items-center justify-between shadow-sm">
                <div>
                    <h1 className="text-[17px] font-bold">Update Order Status</h1>
                    <p className="text-[13px] text-gray-500 dark:text-gray-400">Search & Add Orders</p>
                </div>
                <Link
                    href="/dashboard/sales/daraz"
                    className="flex items-center gap-1 px-2 py-1 text-[13px] bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors"
                >
                    <ArrowLeft size={12} />
                    Back to Sales
                </Link>
            </div>

            {/* Compact Search Section */}
            <div className="sticky top-16 md:top-[44px] z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 shadow-sm">
                <div className="flex flex-wrap items-center gap-1.5">
                    {/* Search By Dropdown */}
                    <select
                        value={searchByField}
                        onChange={(e) => setSearchByField(e.target.value)}
                        className="px-2 py-1 text-sm border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-50"
                    >
                        <option value="order_number">Order Number</option>
                        <option value="tracking_number">Tracking Number</option>
                    </select>

                    {/* Search Input with Mobile Camera */}
                    <div className="flex-1 min-w-[200px] max-w-sm relative">
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={`Enter ${searchByField === 'order_number' ? 'Order Number' : 'Tracking Number'}...`}
                            className="w-full pl-2 pr-8 py-1 text-sm border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-50"
                        />
                        <button
                            onClick={() => setIsCameraOpen(true)}
                            className="md:hidden absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-blue-600 hover:text-blue-700"
                            title="Scan Barcode"
                        >
                            <Camera size={14} />
                        </button>
                    </div>

                    {/* Compact Buttons */}
                    <button
                        onClick={() => handleAddToList()}
                        className="flex items-center gap-1 px-2 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    >
                        <Search size={12} />
                        Add to List
                    </button>
                    <label className="hidden md:flex items-center gap-1 px-2 py-1 text-sm border dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded cursor-pointer transition-colors dark:text-gray-50">
                        <Upload size={12} />
                        Import
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleCSVImport}
                            className="hidden"
                        />
                    </label>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-2">
                <Card className="dark:bg-zinc-900 dark:border-zinc-700 mb-2">
                    <div className="p-3">
                        <h3 className="text-sm font-bold uppercase text-gray-900 dark:text-gray-100 mb-2">Orders ({ordersInList.length})</h3>

                        {ordersInList.length === 0 ? (
                            <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
                                No orders added yet. Search and add orders above.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full table-auto border-collapse">
                                    <thead className="bg-gray-50 dark:bg-zinc-800 sticky top-0 shadow-sm">
                                        <tr>
                                            <th className="px-1.5 py-1 text-left text-xs font-bold uppercase text-gray-900 dark:text-gray-100">Order Number</th>
                                            <th className="px-1.5 py-1 text-left text-xs font-bold uppercase text-gray-900 dark:text-gray-100">Tracking Number</th>
                                            <th className="px-1.5 py-1 text-left text-xs font-bold uppercase text-gray-900 dark:text-gray-100">Product</th>
                                            <th className="px-1.5 py-1 text-left text-xs font-bold uppercase text-gray-900 dark:text-gray-100">Status</th>
                                            <th className="px-1.5 py-1 text-center text-xs font-bold uppercase text-gray-900 dark:text-gray-100 w-12">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
                                        {ordersInList.map((order) => (
                                            <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                                <td className="px-1.5 py-0.5 text-sm text-gray-700 dark:text-gray-300">{order.order_number}</td>
                                                <td className="px-1.5 py-0.5 text-sm text-gray-700 dark:text-gray-300">{order.tracking_number}</td>
                                                <td className="px-1.5 py-0.5 text-sm text-gray-700 dark:text-gray-300">{order.product_name}</td>
                                                <td className="px-1.5 py-0.5">
                                                    <span className="px-1 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                                                        {order.order_status}
                                                    </span>
                                                </td>
                                                <td className="px-1.5 py-0.5 text-center">
                                                    <button
                                                        onClick={() => handleRemoveFromList(order.id)}
                                                        className="p-0.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Compact Bulk Update Section */}
                <Card className="dark:bg-zinc-900 dark:border-zinc-700">
                    <div className="p-3">
                        <h3 className="text-sm font-bold uppercase text-gray-900 dark:text-gray-100 mb-2">Bulk Update Status</h3>
                        <div className="flex items-center gap-1.5">
                            <select
                                value={newStatus}
                                onChange={(e) => setNewStatus(e.target.value)}
                                className="flex-1 px-2 py-1 text-sm border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-50"
                                disabled={ordersInList.length === 0}
                            >
                                <option value="">Select new status...</option>
                                <option value="Shipped">Shipped</option>
                                <option value="Delivered">Delivered</option>
                                <option value="Failed Delivered">Failed Delivered</option>
                                <option value="Customer Return">Customer Return</option>
                            </select>
                            <button
                                onClick={handleBulkUpdate}
                                disabled={ordersInList.length === 0 || !newStatus || isUpdating}
                                className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Check size={12} />
                                {isUpdating ? 'Updating...' : `Update ${ordersInList.length} Orders`}
                            </button>
                        </div>
                    </div>
                </Card>

                {/* Mobile Camera Modal */}
                <BarcodeScannerModal
                    isOpen={isCameraOpen}
                    onClose={() => setIsCameraOpen(false)}
                    onScan={handleBarcodeScan}
                />
            </div>
        </div>
    )
}


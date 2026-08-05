'use client'

import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function PanVatBillingPage() {
    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900">
            <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 flex items-center justify-between shadow-sm">
                <div>
                    <h1 className="text-[17px] font-bold">PAN/VAT Billing</h1>
                    <p className="text-[13px] text-gray-500 dark:text-gray-400">Manage PAN/VAT billing</p>
                </div>
                <Link
                    href="/dashboard/suppliers"
                    className="flex items-center gap-1 px-2 py-1 text-[13px] bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors"
                >
                    <ArrowLeft size={12} />
                    Back to Suppliers
                </Link>
            </div>

            <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-400 dark:text-gray-600">Coming Soon</h2>
                    <p className="text-gray-500 dark:text-gray-500 mt-2">This feature is under development</p>
                </div>
            </div>
        </div>
    )
}

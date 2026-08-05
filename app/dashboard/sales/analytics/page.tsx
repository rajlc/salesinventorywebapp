'use client'

import { ArrowLeft, Construction } from 'lucide-react'
import Link from 'next/link'

export default function SalesAnalyticsPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
            <div className="bg-gray-100 dark:bg-zinc-800 p-6 rounded-full mb-6">
                <Construction size={48} className="text-blue-500" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Coming Soon</h1>
            <p className="text-gray-500 max-w-md mb-8">
                We are working hard to bring you detailed sales analytics and insights. Stay tuned!
            </p>
            <Link
                href="/dashboard/sales"
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
            >
                <ArrowLeft size={20} />
                Back to Sales
            </Link>
        </div>
    )
}

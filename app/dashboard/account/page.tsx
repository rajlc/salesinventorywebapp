'use client'

import { Package, FileText, TrendingUp, CreditCard, ShoppingCart, Truck, Store, Users } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'

export default function AccountPage() {
    const accountModules = [
        {
            name: 'Vat Billing',
            href: '/dashboard/account/pan-vat-billing',
            icon: CreditCard,
            color: 'bg-purple-500',
        },
        {
            name: 'E-commerce Finance',
            href: '/dashboard/account/daraz-account',
            icon: ShoppingCart,
            color: 'bg-orange-500',
        },
        {
            name: 'Logistics Finance',
            href: '/dashboard/account/marketplace-courier',
            icon: Truck,
            color: 'bg-blue-500',
        },
        {
            name: 'Retail Store Finance',
            href: '/dashboard/account/store-account',
            icon: Store,
            color: 'bg-green-500',
        },
    ]

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900 space-y-4">
            {/* Top Bar with Shadow */}
            <div className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-3 shadow-md sticky top-0 z-10">
                <h1 className="text-xl font-bold">Account & Transaction</h1>
            </div>

            <div className="px-4 space-y-4">
                {/* Account Modules Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {accountModules.map((module) => {
                        const Icon = module.icon
                        return (
                            <Link key={module.name} href={module.href}>
                                <Card className="p-3 hover:shadow-lg transition-all cursor-pointer h-full border border-gray-400 dark:border-zinc-600 bg-gray-200 dark:bg-zinc-800 flex flex-col items-center justify-center gap-2 text-center">
                                    <div className={`${module.color} p-2 rounded-md shadow-sm`}>
                                        <Icon size={18} className="text-white" />
                                    </div>
                                    <h3 className="font-semibold text-[15px] text-gray-800 dark:text-gray-100">{module.name}</h3>
                                </Card>
                            </Link>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

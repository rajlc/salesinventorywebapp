'use client'

import Link from 'next/link'
import { Truck, ArrowRight } from 'lucide-react'

const logisticsProviders = [
    {
        title: 'Pathao Courier',
        description: 'Configure API for Pathao Courier integration',
        icon: Truck,
        href: '/dashboard/settings/logistics-api/pathao',
        color: 'bg-red-500',
    },
]

export default function LogisticsApiPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Logistics APIs</h1>
                <p className="text-muted-foreground">Manage your courier API integrations</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {logisticsProviders.map((provider) => {
                    const Icon = provider.icon
                    return (
                        <Link
                            key={provider.href}
                            href={provider.href}
                            className="group block p-6 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg hover:shadow-lg transition-all hover:border-blue-500 dark:hover:border-blue-500"
                        >
                            <div className="flex items-start space-x-4">
                                <div className={`${provider.color} p-3 rounded-lg text-white`}>
                                    <Icon size={24} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                                        {provider.title}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        {provider.description}
                                    </p>
                                </div>
                                <ArrowRight className="text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                            </div>
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}

'use client'

import Link from 'next/link'
import { Store, Calendar, MapPin, CheckCircle, Database, Users, Shield, RefreshCw, Scale, Globe, Brain } from 'lucide-react'

const settingsCards = [
    {
        title: 'Stores Management',
        description: 'Manage online and retail stores',
        icon: Store,
        href: '/dashboard/settings/stores',
        color: 'bg-blue-500',
    },
    {
        title: 'AI Integration',
        description: 'Configure global AI model preference and API credentials',
        icon: Brain,
        href: '/dashboard/settings/ai-integration',
        color: 'bg-orange-500',
    },
    {
        title: 'Fiscal Years',
        description: 'Configure fiscal year periods',
        icon: Calendar,
        href: '/dashboard/settings/fiscal-years',
        color: 'bg-green-500',
    },
    {
        title: 'Logistics Management',
        description: 'Manage delivery locations and APIs',
        icon: MapPin,
        href: '/dashboard/settings/logistics-api',
        color: 'bg-purple-500',
    },
    {
        title: 'Approval Center',
        description: 'Configure approval workflows',
        icon: CheckCircle,
        href: '/dashboard/settings/approvals',
        color: 'bg-orange-500',
    },
    {
        title: 'Restore Backup',
        description: 'Backup and restore data',
        icon: Database,
        href: '/dashboard/settings/backup',
        color: 'bg-red-500',
    },
    {
        title: 'Website & Marketplace Management',
        description: 'Manage website category mapping and rules',
        icon: Globe,
        href: '/dashboard/settings/website-marketplace',
        color: 'bg-indigo-600',
    },
    {
        title: 'Staff Management',
        description: 'Manage staff and permissions',
        icon: Users,
        href: '/dashboard/staff-management',
        color: 'bg-indigo-500',
    },
    {
        title: 'Role Management',
        description: 'Manage page roles and permissions',
        icon: Shield,
        href: '/dashboard/settings/roles',
        color: 'bg-pink-500',
    },
    {
        title: 'Sync Settings',
        description: 'Configure global rules for integration',
        icon: RefreshCw,
        href: '/dashboard/settings/sync-settings',
        color: 'bg-teal-500',
    },
    {
        title: 'Finance & Accounts',
        description: 'Manage units and account parameters',
        icon: Scale,
        href: '/dashboard/settings/finance-accounts',
        color: 'bg-amber-500',
    },
]

export default function SettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Settings</h1>
                <p className="text-muted-foreground">Configure your system settings and preferences</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {settingsCards.map((card) => {
                    const Icon = card.icon
                    return (
                        <Link
                            key={card.href}
                            href={card.href}
                            className="group block p-6 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg hover:shadow-lg transition-all hover:border-blue-500 dark:hover:border-blue-500"
                        >
                            <div className="flex items-start space-x-4">
                                <div className={`${card.color} p-3 rounded-lg text-white`}>
                                    <Icon size={24} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                                        {card.title}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        {card.description}
                                    </p>
                                </div>
                            </div>
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}

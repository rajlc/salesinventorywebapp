'use client'

import { useState } from 'react'
import OnlineStoreList from '@/features/settings/components/OnlineStoreList'
import RetailStoreList from '@/features/settings/components/RetailStoreList'
import CompanyDetailsList from '@/features/settings/components/CompanyDetailsList'
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader"

export default function StoresPage() {
    const [activeStoreTab, setActiveStoreTab] = useState<'online' | 'retail' | 'company'>('online')

    return (
        <div className="space-y-6">
            <SettingsPageHeader
                title="Stores"
                subtitle="Manage your online and retail store locations"
            />

            {/* Sub-tabs for Online/Retail/Company */}
            <div className="border-b border-gray-200 dark:border-zinc-700">
                <nav className="flex space-x-6">
                    <button
                        onClick={() => setActiveStoreTab('online')}
                        className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeStoreTab === 'online'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                            }`}
                    >
                        Online Stores
                    </button>
                    <button
                        onClick={() => setActiveStoreTab('retail')}
                        className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeStoreTab === 'retail'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                            }`}
                    >
                        Retail Stores
                    </button>
                    <button
                        onClick={() => setActiveStoreTab('company')}
                        className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeStoreTab === 'company'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                            }`}
                    >
                        Company Details
                    </button>
                </nav>
            </div>

            {/* Store Tab Content */}
            <div>
                {activeStoreTab === 'online' && <OnlineStoreList />}
                {activeStoreTab === 'retail' && <RetailStoreList />}
                {activeStoreTab === 'company' && <CompanyDetailsList />}
            </div>
        </div>
    )
}

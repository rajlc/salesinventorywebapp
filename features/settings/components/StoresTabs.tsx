'use client'

import { useState } from 'react'
import OnlineStoreList from './OnlineStoreList'
import RetailStoreList from './RetailStoreList'

export default function StoresTabs() {
    const [activeStoreTab, setActiveStoreTab] = useState<'online' | 'retail'>('online')

    return (
        <div className="space-y-4">
            {/* Sub-tabs for Online/Retail */}
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
                </nav>
            </div>

            {/* Store Tab Content */}
            <div>
                {activeStoreTab === 'online' && <OnlineStoreList />}
                {activeStoreTab === 'retail' && <RetailStoreList />}
            </div>
        </div>
    )
}

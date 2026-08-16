'use client'

import { Suspense } from 'react'
import { ProfitTrackerContent } from './profit-tracker-content'

export default function ProfitTrackerPage() {
    return (
        <Suspense fallback={<div className="p-4 text-center">Loading profit tracker...</div>}>
            <ProfitTrackerContent isEmbedded={false} />
        </Suspense>
    )
}

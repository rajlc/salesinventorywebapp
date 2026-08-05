'use client'

import { Suspense } from 'react'
import { DarazOrderList } from '@/features/sales/components/DarazOrderList'

export const dynamic = 'force-dynamic'

export default function DarazOrderListPage() {
    return (
        <Suspense fallback={<div className="p-4 text-center">Loading orders...</div>}>
            <DarazOrderList isEmbedded={false} />
        </Suspense>
    )
}
 


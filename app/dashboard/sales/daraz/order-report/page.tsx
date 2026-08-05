import { DarazOrderReport } from '@/features/sales/components/DarazOrderReport'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Daraz Order Report | Inventory Management',
    description: 'Manage and view Daraz order reports',
}

export default function DarazOrderReportPage() {
    return <DarazOrderReport />
}

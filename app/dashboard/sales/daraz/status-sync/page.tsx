import { OrderStatusSyncTable } from '@/features/sales/components/OrderStatusSyncTable'

export default function OrderStatusSyncPage() {
    return (
        <div className="container mx-auto pt-16 md:pt-6 pb-6">
            <h1 className="hidden md:block text-2xl font-bold mb-6 px-6">Order Status Sync</h1>
            <OrderStatusSyncTable />
        </div>
    )
}

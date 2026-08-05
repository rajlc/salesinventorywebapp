'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui-shim'
import { ShoppingBag } from 'lucide-react'
import { UserOrder } from '../actions/profile-actions'
import { useRouter } from 'next/navigation'
import { AddOrderModal } from './AddOrderModal'

interface UserOrderListProps {
    orders: UserOrder[]
}

export function UserOrderList({ orders }: UserOrderListProps) {
    const router = useRouter()

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5" />
                    My Recent Orders
                </CardTitle>
                <AddOrderModal onOrderAdded={() => router.refresh()} />
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-zinc-800 text-gray-500">
                            <tr>
                                <th className="px-3 py-2">Date</th>
                                <th className="px-3 py-2">Customer</th>
                                <th className="px-3 py-2">Type</th>
                                <th className="px-3 py-2">Status</th>
                                <th className="px-3 py-2 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-zinc-700">
                            {orders.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-4 text-gray-500">No recent orders found</td>
                                </tr>
                            ) : (
                                orders.map((order) => (
                                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800">
                                        <td className="px-3 py-2">{new Date(order.order_date).toLocaleDateString()}</td>
                                        <td className="px-3 py-2 font-medium">{order.customer_name}</td>
                                        <td className="px-3 py-2 text-xs text-gray-500">{order.type}</td>
                                        <td className="px-3 py-2">
                                            <span className={`px-2 py-0.5 rounded-full text-xs ${order.status === 'Completed' || order.status === 'Delivered' ? 'bg-green-100 text-green-700' :
                                                'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium">
                                            Rs {order.total_amount.toLocaleString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    )
}

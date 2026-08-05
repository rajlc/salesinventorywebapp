"use client"

import { useQuery } from "@tanstack/react-query"
import { getCouriers, updateCourierStatus, deleteCourier } from "../actions/courier-actions"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

export default function CourierList() {
    const { data: couriers, isLoading, refetch } = useQuery({
        queryKey: ['couriers'],
        queryFn: async () => await getCouriers()
    })

    const handleToggleStatus = async (id: string, currentStatus: boolean, courierName: string) => {
        try {
            await updateCourierStatus(id, !currentStatus)
            toast.success(`${courierName} ${!currentStatus ? 'activated' : 'deactivated'} successfully`)
            refetch()
        } catch (error: any) {
            console.error("Failed to toggle status:", error)
            // Show the specific error message from the server
            toast.error(error.message || "Failed to update status. Please try again.")
        }
    }

    const handleDelete = async (id: string, courierName: string) => {
        if (confirm(`Are you sure you want to delete ${courierName}?`)) {
            try {
                await deleteCourier(id)
                toast.success(`${courierName} deleted successfully`)
                refetch()
            } catch (error) {
                console.error("Failed to delete courier:", error)
                toast.error("Failed to delete courier. Please try again.")
            }
        }
    }

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500">Loading couriers...</div>
    }

    if (!couriers?.length) {
        return (
            <div className="p-12 text-center border-2 border-dashed rounded-lg text-gray-500">
                No courier providers found. Add one to get started.
            </div>
        )
    }

    // Find the active courier
    const activeCourier = couriers?.find(c => c.is_active)

    return (
        <div className="space-y-4">
            {/* Active Courier Display */}
            {activeCourier && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-green-900 dark:text-green-100">
                            Active Courier:
                        </span>
                        <span className="text-sm font-bold text-green-700 dark:text-green-400">
                            {activeCourier.courier_name}
                        </span>
                    </div>
                </div>
            )}

            <div className="overflow-x-auto rounded-lg border dark:border-zinc-700">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 dark:bg-zinc-900 text-gray-500 uppercase">
                        <tr>
                            <th className="px-6 py-3 font-medium">S.N</th>
                            <th className="px-6 py-3 font-medium">Courier Name</th>
                            <th className="px-6 py-3 font-medium">Status</th>
                            <th className="px-6 py-3 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-zinc-700">
                        {couriers.map((courier, index) => (
                            <tr key={courier.id} className="bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700/50">
                                <td className="px-6 py-4 text-gray-500">
                                    {index + 1}
                                </td>
                                <td className="px-6 py-4">
                                    <Link
                                        href={`/dashboard/settings/couriers/${courier.id}`}
                                        className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                                    >
                                        {courier.courier_name}
                                    </Link>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${courier.is_active
                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                        : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                                        }`}>
                                        {courier.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        {/* Toggle Switch */}
                                        <button
                                            onClick={() => handleToggleStatus(courier.id, courier.is_active, courier.courier_name)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${courier.is_active
                                                    ? 'bg-green-500 focus:ring-green-500'
                                                    : 'bg-gray-300 dark:bg-gray-600 focus:ring-gray-400'
                                                }`}
                                            title={courier.is_active ? "Click to Deactivate" : "Click to Activate"}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${courier.is_active ? 'translate-x-6' : 'translate-x-1'
                                                    }`}
                                            />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(courier.id, courier.courier_name)}
                                            className="text-red-500 hover:text-red-700 p-2 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                                            title="Delete Courier"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

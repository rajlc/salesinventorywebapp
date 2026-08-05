"use client"

import { useQuery } from "@tanstack/react-query"
import { getCourierLocations, deleteCourierLocation } from "../actions/courier-location-actions"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

interface CourierLocationListProps {
    courierId: string
}

export default function CourierLocationList({ courierId }: CourierLocationListProps) {
    const { data: locations, isLoading, refetch } = useQuery({
        queryKey: ['courier-locations', courierId],
        queryFn: async () => await getCourierLocations(courierId)
    })

    const handleDelete = async (id: string, branchName: string) => {
        if (confirm(`Are you sure you want to delete ${branchName}?`)) {
            try {
                await deleteCourierLocation(id, courierId)
                toast.success(`${branchName} deleted successfully`)
                refetch()
            } catch (error) {
                console.error("Failed to delete location:", error)
                toast.error("Failed to delete location. Please try again.")
            }
        }
    }

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500">Loading locations...</div>
    }

    if (!locations?.length) {
        return (
            <div className="p-12 text-center border-2 border-dashed rounded-lg text-gray-500">
                No locations found. Add one manually or upload via CSV.
            </div>
        )
    }

    return (
        <div className="overflow-x-auto rounded-lg border dark:border-zinc-700">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-zinc-900 text-gray-500 uppercase">
                    <tr>
                        <th className="px-6 py-3 font-medium">S.N</th>
                        <th className="px-6 py-3 font-medium">Branch</th>
                        <th className="px-6 py-3 font-medium">Delivery Charge</th>
                        <th className="px-6 py-3 font-medium">Cover Area</th>
                        <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y dark:divide-zinc-700">
                    {locations.map((location, index) => (
                        <tr key={location.id} className="bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700/50">
                            <td className="px-6 py-4 text-gray-500">
                                {index + 1}
                            </td>
                            <td className="px-6 py-4 font-semibold text-blue-600 dark:text-blue-400">
                                {location.branch_name}
                            </td>
                            <td className="px-6 py-4 font-medium">
                                Rs. {location.delivery_charge.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-gray-500">
                                {location.cover_area || "-"}
                            </td>
                            <td className="px-6 py-4 text-right">
                                <button
                                    onClick={() => handleDelete(location.id, location.branch_name)}
                                    className="text-red-500 hover:text-red-700 p-2 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                                    title="Delete Location"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { X } from "lucide-react"
import { createCourierLocation } from "../actions/courier-location-actions"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

const formSchema = z.object({
    branch_name: z.string().min(1, "Branch name is required"),
    delivery_charge: z.number().min(0, "Delivery charge must be a positive number"),
    cover_area: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

interface AddCourierLocationDialogProps {
    isOpen: boolean
    onClose: () => void
    courierId: string
}

export default function AddCourierLocationDialog({ isOpen, onClose, courierId }: AddCourierLocationDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const queryClient = useQueryClient()
    const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            branch_name: "",
            delivery_charge: 0,
            cover_area: "",
        },
    })

    const onSubmit = async (data: FormData) => {
        try {
            setIsSubmitting(true)
            await createCourierLocation(courierId, {
                branch_name: data.branch_name,
                delivery_charge: data.delivery_charge,
                cover_area: data.cover_area || "",
            })
            toast.success("Location added successfully")
            queryClient.invalidateQueries({ queryKey: ['courier-locations', courierId] })
            reset()
            onClose()
        } catch (error) {
            console.error("Failed to add location:", error)
            toast.error("Failed to add location. Please try again.")
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between p-4 border-b dark:border-zinc-700">
                    <h2 className="text-lg font-semibold">Add New Location</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            Branch <span className="text-red-500">*</span>
                        </label>
                        <input
                            {...register("branch_name")}
                            className="w-full p-2 border rounded-md dark:bg-zinc-900 dark:border-zinc-700 uppercase"
                            placeholder="e.g. KATHMANDU"
                            onChange={(e) => {
                                e.target.value = e.target.value.toUpperCase()
                                register("branch_name").onChange(e)
                            }}
                        />
                        {errors.branch_name && (
                            <p className="text-xs text-red-500">{errors.branch_name.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            Delivery Charge <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            {...register("delivery_charge", { valueAsNumber: true })}
                            className="w-full p-2 border rounded-md dark:bg-zinc-900 dark:border-zinc-700"
                            placeholder="e.g. 100"
                        />
                        {errors.delivery_charge && (
                            <p className="text-xs text-red-500">{errors.delivery_charge.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Cover Area</label>
                        <input
                            {...register("cover_area")}
                            className="w-full p-2 border rounded-md dark:bg-zinc-900 dark:border-zinc-700"
                            placeholder="e.g. Thamel, Lazimpat"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 dark:bg-zinc-700 dark:text-gray-200 dark:hover:bg-zinc-600"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                            {isSubmitting ? "Adding..." : "Add Location"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

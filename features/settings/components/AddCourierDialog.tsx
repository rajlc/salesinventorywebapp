"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { X } from "lucide-react"
import { createCourier } from "../actions/courier-actions"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

const formSchema = z.object({
    courier_id: z.string().min(1, "ID is required"),
    courier_name: z.string().min(1, "Courier name is required"),
    additional_details: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

interface AddCourierDialogProps {
    isOpen: boolean
    onClose: () => void
}

export default function AddCourierDialog({ isOpen, onClose }: AddCourierDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const queryClient = useQueryClient()
    const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            courier_id: "",
            courier_name: "",
            additional_details: "",
        },
    })

    const onSubmit = async (data: FormData) => {
        try {
            setIsSubmitting(true)
            await createCourier({
                courier_id: data.courier_id,
                courier_name: data.courier_name,
                additional_details: data.additional_details || "",
            })
            toast.success("Added Successfully")
            queryClient.invalidateQueries({ queryKey: ['couriers'] })
            reset()
            onClose()
        } catch (error) {
            console.error("Failed to add courier:", error)
            toast.error("Failed to add courier. Please try again.")
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between p-4 border-b dark:border-zinc-700">
                    <h2 className="text-lg font-semibold">Add New Courier</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            ID <span className="text-red-500">*</span>
                        </label>
                        <input
                            {...register("courier_id")}
                            className="w-full p-2 border rounded-md dark:bg-zinc-900 dark:border-zinc-700 uppercase"
                            placeholder="e.g. DHL001"
                            onChange={(e) => {
                                e.target.value = e.target.value.toUpperCase()
                                register("courier_id").onChange(e)
                            }}
                        />
                        {errors.courier_id && (
                            <p className="text-xs text-red-500">{errors.courier_id.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            Courier Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            {...register("courier_name")}
                            className="w-full p-2 border rounded-md dark:bg-zinc-900 dark:border-zinc-700"
                            placeholder="e.g. DHL Express"
                        />
                        {errors.courier_name && (
                            <p className="text-xs text-red-500">{errors.courier_name.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Additional Details</label>
                        <textarea
                            {...register("additional_details")}
                            className="w-full p-2 border rounded-md dark:bg-zinc-900 dark:border-zinc-700 min-h-[80px]"
                            placeholder="e.g. International courier service, tracking available"
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
                            {isSubmitting ? "Adding..." : "Add Courier"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

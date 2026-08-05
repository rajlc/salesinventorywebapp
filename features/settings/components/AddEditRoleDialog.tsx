"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { X } from "lucide-react"
import { createPageRole, updatePageRole } from "../actions/role-actions"
import type { PageRole } from "../actions/role-actions"

const formSchema = z.object({
    main_role: z.string().min(1, "Main page role is required"),
    sub_role: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

interface AddEditRoleDialogProps {
    isOpen: boolean
    onClose: () => void
    editRole?: PageRole | null
    onUpdate?: () => void
}

export default function AddEditRoleDialog({ isOpen, onClose, editRole, onUpdate }: AddEditRoleDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const isEditing = !!editRole

    const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            main_role: "",
            sub_role: "",
        },
    })

    useEffect(() => {
        if (editRole) {
            reset({
                main_role: editRole.main_role,
                sub_role: editRole.sub_role || "",
            })
        } else {
            reset({
                main_role: "",
                sub_role: "",
            })
        }
    }, [editRole, reset])

    const onSubmit = async (data: FormData) => {
        try {
            setIsSubmitting(true)

            if (isEditing && editRole) {
                await updatePageRole(editRole.id, {
                    main_role: data.main_role,
                    sub_role: data.sub_role || null,
                    page_url: editRole.page_url,
                })
            } else {
                await createPageRole({
                    main_role: data.main_role,
                    sub_role: data.sub_role || null,
                    page_url: null,
                })
            }

            reset()
            onClose()
            onUpdate?.()
        } catch (error) {
            console.error("Failed to save role:", error)
            alert("Failed to save role. Please try again.")
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between p-4 border-b dark:border-zinc-700">
                    <h2 className="text-lg font-semibold">
                        {isEditing ? "Edit Role" : "Add New Role"}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            Main Page Role <span className="text-red-500">*</span>
                        </label>
                        <input
                            {...register("main_role")}
                            className="w-full p-2 border rounded-md dark:bg-zinc-900 dark:border-zinc-700"
                            placeholder="e.g. Dashboard, Sales, Inventory"
                        />
                        {errors.main_role && (
                            <p className="text-xs text-red-500">{errors.main_role.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Sub Page Role</label>
                        <input
                            {...register("sub_role")}
                            className="w-full p-2 border rounded-md dark:bg-zinc-900 dark:border-zinc-700"
                            placeholder="e.g. All Orders, Categories (optional)"
                        />
                        {errors.sub_role && (
                            <p className="text-xs text-red-500">{errors.sub_role.message}</p>
                        )}
                        <p className="text-xs text-gray-500">
                            Leave blank if this is a main page without sub-pages
                        </p>
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
                            {isSubmitting ? "Saving..." : (isEditing ? "Update Role" : "Add Role")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

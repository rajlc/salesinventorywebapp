"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"

interface SettingsPageHeaderProps {
    title: string
    subtitle?: string
    backUrl?: string
}

export function SettingsPageHeader({
    title,
    subtitle,
    backUrl = "/dashboard/settings"
}: SettingsPageHeaderProps) {
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 mt-2">
            <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                    {title}
                </h1>
                {subtitle && (
                    <p className="text-sm text-muted-foreground mt-1">
                        {subtitle}
                    </p>
                )}
            </div>

            <Link
                href={backUrl}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition-colors shadow-sm"
            >
                <ArrowLeft size={16} />
                Back to Settings
            </Link>
        </div>
    )
}

'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui-shim'
import { Shield, UserCheck, Mail, Sparkles, CheckCircle2 } from 'lucide-react'

interface ProfileHeaderProps {
    user: {
        full_name?: string | null
        email?: string | null
        role?: string | null
        created_at?: string
    }
}

export function ProfileHeader({ user }: ProfileHeaderProps) {
    const roleStr = user?.role || 'user'
    const isAdmin = roleStr === 'admin'
    const displayName = user?.full_name || 'Staff User'
    const emailStr = user?.email || 'user@example.com'
    const initial = (user?.full_name ? user.full_name.charAt(0) : (emailStr ? emailStr.charAt(0) : 'U')).toUpperCase()

    return (
        <Card className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm mb-6 rounded-2xl overflow-hidden">
            <CardContent className="p-5 md:p-7 flex flex-col md:flex-row md:items-center justify-between gap-6">
                {/* Left: Avatar & Profile Info */}
                <div className="flex items-center gap-4 md:gap-5">
                    {/* Modern Avatar with gradient ring */}
                    <div className="relative shrink-0">
                        <div className="h-16 w-16 md:h-20 md:w-20 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 p-0.5 shadow-md shadow-blue-500/20">
                            <div className="h-full w-full rounded-[14px] bg-white dark:bg-zinc-900 flex items-center justify-center text-blue-600 dark:text-blue-400 text-2xl md:text-3xl font-bold">
                                {initial}
                            </div>
                        </div>
                        {/* Status Green Indicator Dot */}
                        <span className="absolute -bottom-1 -right-1 h-5 w-5 bg-emerald-500 rounded-full border-2 border-white dark:border-zinc-900 flex items-center justify-center shadow-xs" title="Account Active">
                            <CheckCircle2 size={12} className="text-white" />
                        </span>
                    </div>

                    <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                                {displayName}
                            </h1>

                            {/* Role Badge */}
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${
                                isAdmin
                                    ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
                                    : 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                            }`}>
                                {isAdmin ? <Shield size={12} /> : <UserCheck size={12} />}
                                {roleStr.replace('_', ' ')}
                            </span>

                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                                Active Status
                            </span>
                        </div>

                        {/* Email */}
                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
                            <Mail size={14} className="text-slate-400" />
                            <span>{emailStr}</span>
                        </div>

                        <p className="text-xs text-slate-400 dark:text-zinc-500">
                            Bagmati ERP System Account • Single Sign-On Verified
                        </p>
                    </div>
                </div>

                {/* Right: Quick Highlights / Badges (Switch to Mobile Mode REMOVED) */}
                <div className="flex items-center gap-3 self-start md:self-center">
                    <div className="px-4 py-2.5 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-800/50 text-right">
                        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Access Level</span>
                        <span className="text-xs md:text-sm font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5 justify-end mt-0.5">
                            {isAdmin ? (
                                <>
                                    <Sparkles size={14} className="text-amber-500" />
                                    Administrator
                                </>
                            ) : (
                                <>
                                    <UserCheck size={14} className="text-blue-500" />
                                    Staff Operator
                                </>
                            )}
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

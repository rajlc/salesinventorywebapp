'use client'

import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, Label, Input, Button } from '@/components/ui-shim'
import { updateProfile, verifyAndChangePassword } from '../actions/profile-actions'
import { Edit2, Lock, User, Mail, Phone, MapPin, X, Check, KeyRound } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface ProfileDetailsProps {
    user: {
        full_name: string | null
        phone_number: string
        address: string
        email: string
    }
}

export function ProfileDetails({ user }: ProfileDetailsProps) {
    const router = useRouter()
    const [isEditing, setIsEditing] = useState(false)
    const [showPasswordChange, setShowPasswordChange] = useState(false)
    const [loading, setLoading] = useState(false)

    // Profile Data State
    const [formData, setFormData] = useState({
        full_name: user.full_name || '',
        phone_number: user.phone_number || '',
        address: user.address || ''
    })

    // Password State
    const [passwords, setPasswords] = useState({
        current: '',
        new: '',
        confirm: ''
    })

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            await updateProfile(formData)
            setIsEditing(false)
            alert('Profile updated successfully')
        } catch (error: any) {
            alert(error.message)
        } finally {
            setLoading(false)
        }
    }

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        if (passwords.new !== passwords.confirm) {
            alert("New passwords don't match")
            return
        }

        setLoading(true)
        try {
            await verifyAndChangePassword(passwords.current, passwords.new)
            alert('Password changed successfully. You will be logged out.')
            setPasswords({ current: '', new: '', confirm: '' })
            setShowPasswordChange(false)
            router.push('/login')
        } catch (error: any) {
            alert(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card className="h-full bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm rounded-2xl overflow-hidden flex flex-col justify-between">
            <div>
                <CardHeader className="flex flex-row items-center justify-between p-5 md:p-6 border-b border-slate-100 dark:border-zinc-800">
                    <CardTitle className="text-base md:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <User size={18} className="text-blue-600 dark:text-blue-400" />
                        Profile Details
                    </CardTitle>
                    {!isEditing && !showPasswordChange && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsEditing(true)}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-zinc-800 rounded-lg"
                        >
                            <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                            Edit Info
                        </Button>
                    )}
                </CardHeader>

                <CardContent className="p-5 md:p-6 space-y-5">
                    {/* View Mode */}
                    {!isEditing && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-3.5">
                                <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800">
                                    <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1">
                                        <User size={13} />
                                        <span>Full Name</span>
                                    </div>
                                    <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                                        {user.full_name || 'Not provided'}
                                    </p>
                                </div>

                                <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800">
                                    <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1">
                                        <Mail size={13} />
                                        <span>Email Address</span>
                                    </div>
                                    <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                                        {user.email}
                                    </p>
                                </div>

                                <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800">
                                    <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1">
                                        <Phone size={13} />
                                        <span>Phone Number</span>
                                    </div>
                                    <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                                        {user.phone_number || 'Not provided'}
                                    </p>
                                </div>

                                <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800">
                                    <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1">
                                        <MapPin size={13} />
                                        <span>Address</span>
                                    </div>
                                    <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                                        {user.address || 'Not provided'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Edit Mode */}
                    {isEditing && (
                        <form onSubmit={handleUpdateProfile} className="space-y-4 animate-in fade-in">
                            <div className="space-y-1.5">
                                <Label htmlFor="full_name" className="text-xs font-medium text-slate-600 dark:text-slate-400">Full Name</Label>
                                <Input
                                    id="full_name"
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                    className="h-9 rounded-lg"
                                    placeholder="Enter your full name"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="phone" className="text-xs font-medium text-slate-600 dark:text-slate-400">Phone Number</Label>
                                <Input
                                    id="phone"
                                    value={formData.phone_number}
                                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                                    className="h-9 rounded-lg"
                                    placeholder="e.g. +977 9800000000"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="address" className="text-xs font-medium text-slate-600 dark:text-slate-400">Address</Label>
                                <Input
                                    id="address"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    className="h-9 rounded-lg"
                                    placeholder="City, District"
                                />
                            </div>
                            <div className="flex items-center gap-2 pt-2">
                                <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg h-9 text-xs font-semibold">
                                    {loading ? 'Saving...' : 'Save Profile'}
                                </Button>
                                <Button type="button" variant="ghost" onClick={() => setIsEditing(false)} disabled={loading} className="rounded-lg h-9 text-xs">
                                    Cancel
                                </Button>
                            </div>
                        </form>
                    )}

                    {/* Change Password Modal / Card */}
                    {showPasswordChange && !isEditing && (
                        <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 animate-in fade-in">
                            <div className="flex items-center justify-between mb-3 pb-2 border-b border-blue-100 dark:border-blue-900/40">
                                <h4 className="font-semibold text-xs text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                                    <KeyRound size={14} className="text-blue-600" />
                                    Change Password
                                </h4>
                                <button onClick={() => setShowPasswordChange(false)} className="text-slate-400 hover:text-slate-600">
                                    <X size={14} />
                                </button>
                            </div>

                            <form onSubmit={handleChangePassword} className="space-y-3">
                                <div className="space-y-1">
                                    <Label htmlFor="current_password" className="text-[11px] text-slate-600 dark:text-slate-400">Current Password</Label>
                                    <Input
                                        id="current_password"
                                        type="password"
                                        value={passwords.current}
                                        onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                                        className="h-8 text-xs rounded-lg bg-white dark:bg-zinc-900"
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="new_password" className="text-[11px] text-slate-600 dark:text-slate-400">New Password</Label>
                                    <Input
                                        id="new_password"
                                        type="password"
                                        value={passwords.new}
                                        onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                                        className="h-8 text-xs rounded-lg bg-white dark:bg-zinc-900"
                                        placeholder="Min 6 characters"
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="confirm_password" className="text-[11px] text-slate-600 dark:text-slate-400">Confirm Password</Label>
                                    <Input
                                        id="confirm_password"
                                        type="password"
                                        value={passwords.confirm}
                                        onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                                        className="h-8 text-xs rounded-lg bg-white dark:bg-zinc-900"
                                        required
                                    />
                                </div>
                                <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg h-8 text-xs font-semibold mt-1">
                                    {loading ? 'Updating...' : 'Confirm Update'}
                                </Button>
                            </form>
                        </div>
                    )}
                </CardContent>
            </div>

            {/* Change Password Footer Toggle */}
            {!showPasswordChange && !isEditing && (
                <div className="p-4 md:p-6 pt-0 border-t border-slate-100 dark:border-zinc-800">
                    <Button
                        variant="outline"
                        className="w-full justify-center text-xs font-semibold rounded-xl border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800"
                        onClick={() => setShowPasswordChange(true)}
                    >
                        <Lock className="h-3.5 w-3.5 mr-2 text-slate-500" />
                        Update Security Password
                    </Button>
                </div>
            )}
        </Card>
    )
}

'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, Label, Input, Button, Separator } from '@/components/ui-shim'
import { updateProfile, verifyAndChangePassword } from '../actions/profile-actions'
import { Edit2, Save, X, Lock } from 'lucide-react'
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
            // Force logout client-side behavior
            router.push('/login')
        } catch (error: any) {
            alert(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle>Profile Details</CardTitle>
                {!isEditing && !showPasswordChange && (
                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit
                    </Button>
                )}
            </CardHeader>
            <CardContent className="space-y-6">

                {/* View Mode */}
                {!isEditing && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label className="text-muted-foreground">Full Name</Label>
                                <p className="font-medium text-sm md:text-lg">{user.full_name || 'N/A'}</p>
                            </div>
                            <div>
                                <Label className="text-muted-foreground">Email</Label>
                                <p className="font-medium text-sm md:text-lg">{user.email}</p>
                            </div>
                            <div>
                                <Label className="text-muted-foreground">Phone Number</Label>
                                <p className="font-medium text-sm md:text-lg">{user.phone_number || 'N/A'}</p>
                            </div>
                            <div>
                                <Label className="text-muted-foreground">Address</Label>
                                <p className="font-medium text-sm md:text-lg">{user.address || 'N/A'}</p>
                            </div>
                        </div>

                        <Separator />

                        {/* Change Password Toggle */}
                        {!showPasswordChange && (
                            <Button
                                variant="outline"
                                className="w-full justify-start"
                                onClick={() => setShowPasswordChange(true)}
                            >
                                <Lock className="h-4 w-4 mr-2" />
                                Change Password
                            </Button>
                        )}
                    </div>
                )}

                {/* Edit Mode */}
                {isEditing && (
                    <form onSubmit={handleUpdateProfile} className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="space-y-2">
                            <Label htmlFor="full_name">Full Name</Label>
                            <Input
                                id="full_name"
                                value={formData.full_name}
                                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone Number</Label>
                            <Input
                                id="phone"
                                value={formData.phone_number}
                                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="address">Address</Label>
                            <Input
                                id="address"
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center gap-2 pt-2">
                            <Button type="submit" disabled={loading} className="w-full">
                                {loading ? 'Saving...' : 'Save Changes'}
                            </Button>
                            <Button type="button" variant="ghost" onClick={() => setIsEditing(false)} disabled={loading}>
                                Cancel
                            </Button>
                        </div>
                    </form>
                )}

                {/* Change Password Mode (Box) */}
                {showPasswordChange && !isEditing && (
                    <div className="p-4 border rounded-lg bg-gray-50 dark:bg-zinc-800 animate-in fade-in zoom-in-95">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold flex items-center gap-2">
                                <Lock className="h-4 w-4" />
                                Change Password
                            </h3>
                            <button onClick={() => setShowPasswordChange(false)} className="text-gray-500 hover:text-gray-700">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleChangePassword} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="current_password">Current Password</Label>
                                <Input
                                    id="current_password"
                                    type="password"
                                    value={passwords.current}
                                    onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                                    placeholder="Enter current password"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="new_password">New Password</Label>
                                <Input
                                    id="new_password"
                                    type="password"
                                    value={passwords.new}
                                    onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                                    placeholder="Min 6 chars, letters & numbers"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirm_password">Confirm New Password</Label>
                                <Input
                                    id="confirm_password"
                                    type="password"
                                    value={passwords.confirm}
                                    onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                                    placeholder="Confirm new password"
                                    required
                                />
                            </div>
                            <Button type="submit" disabled={loading} variant="destructive" className="w-full">
                                {loading ? 'Verifying & Updating...' : 'Confirm Change Password'}
                            </Button>
                        </form>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

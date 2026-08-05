'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent, Label, Input, Button } from '@/components/ui-shim'
import { verifyAndChangePassword } from '../actions/profile-actions'

export function SecuritySettings() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [passwords, setPasswords] = useState({
        current: '',
        new: '',
        confirm: ''
    })

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
            // Small delay to allow alert to be seen
            setTimeout(() => {
                window.location.href = '/login'
            }, 1000)
        } catch (error: any) {
            alert(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle>Security Settings</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleChangePassword} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="current_password">Current Password</Label>
                        <Input
                            id="current_password"
                            type="password"
                            value={passwords.current}
                            onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                            placeholder="Enter current password"
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
                        />
                    </div>
                    <Button type="submit" disabled={loading} variant="destructive">
                        {loading ? 'Updating...' : 'Change Password'}
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}

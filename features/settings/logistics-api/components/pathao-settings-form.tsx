'use client'

import { useState } from 'react'
import { savePathaoSettings } from '../actions'
import { Button, Input, Label, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui-shim'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'

interface PathaoSettingsFormProps {
    initialSettings: any
}

export function PathaoSettingsForm({ initialSettings }: PathaoSettingsFormProps) {
    const [isLoading, setIsLoading] = useState(false)

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setIsLoading(true)

        const formData = new FormData(event.currentTarget)
        const result = await savePathaoSettings(formData)

        if (result?.error) {
            toast.error(result.error)
        } else {
            toast.success('Settings saved successfully')
        }

        setIsLoading(false)
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>API Credentials</CardTitle>
                <CardDescription>
                    Enter your Pathao Merchant API credentials provided by Pathao.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={onSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="base_url">Base URL</Label>
                        <Input
                            id="base_url"
                            name="base_url"
                            placeholder="https://api-hermes.pathao.com"
                            defaultValue={initialSettings?.base_url || 'https://api-hermes.pathao.com'}
                            required
                        />
                        <p className="text-xs text-muted-foreground">Use <code>https://courier-api-sandbox.pathao.com</code> for sandbox.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="client_id">Client ID</Label>
                            <Input
                                id="client_id"
                                name="client_id"
                                type="text"
                                defaultValue={initialSettings?.client_id || ''}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="client_secret">Client Secret</Label>
                            <Input
                                id="client_secret"
                                name="client_secret"
                                type="password"
                                defaultValue={initialSettings?.client_secret || ''}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="username">Username (Email)</Label>
                            <Input
                                id="username"
                                name="username"
                                type="email"
                                defaultValue={initialSettings?.username || ''}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                defaultValue={initialSettings?.password || ''}
                                required
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Save Settings
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}

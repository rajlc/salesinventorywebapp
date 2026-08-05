"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase/client"
import { Button, Card, CardHeader, CardTitle, CardContent } from "@/components/ui-shim"

export function SignupRequestForm() {
    const [isLoading, setIsLoading] = React.useState(false)

    async function onGoogleLogin() {
        setIsLoading(true)
        try {
            // Note: For OAuth, we can't check for duplicates before signup
            // The duplicate check and status messaging will happen after OAuth callback
            await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${location.origin}/auth/callback?type=request_access`,
                },
            })
        } catch (error) {
            console.error(error)
            setIsLoading(false)
        }
    }

    return (
        <Card className="w-[350px] shadow-lg border-t-4 border-t-yellow-500">
            <CardHeader>
                <CardTitle className="text-2xl text-center">Request Access</CardTitle>
                <p className="text-sm text-center text-muted-foreground">
                    New Staff? Authenticate with your Google Account to request approval from Admin.
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                <Button
                    className="w-full bg-white text-black border border-gray-300 hover:bg-gray-50"
                    onClick={onGoogleLogin}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path></svg>
                    )}
                    Continue with Google
                </Button>

                <p className="text-xs text-center text-muted-foreground mt-4">
                    Once you sign in, your request will be sent to the Admin Dashboard for approval.
                </p>
            </CardContent>
        </Card>
    )
}

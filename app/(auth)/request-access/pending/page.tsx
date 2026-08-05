"use client"

import { Button, Card, CardHeader, CardTitle, CardContent } from "@/components/ui-shim"
import { CheckCircle2 } from "lucide-react"
import Link from "next/link"

export default function RequestPendingPage() {
    return (
        <Card className="w-[400px] shadow-lg border-t-4 border-t-green-500">
            <CardHeader>
                <div className="flex justify-center mb-4">
                    <CheckCircle2 className="h-12 w-12 text-green-500" />
                </div>
                <CardTitle className="text-2xl text-center">Request Sent!</CardTitle>
                <p className="text-sm text-center text-muted-foreground">
                    Your access request has been submitted to the Administrator.
                </p>
            </CardHeader>
            <CardContent className="text-center space-y-4">
                <p className="text-sm">
                    Please wait for an approval email or contact your manager to approve your account.
                </p>
                <div className="p-4 bg-gray-50 rounded-md text-xs text-gray-500">
                    Reference: {new Date().toLocaleDateString()}
                </div>

                <Link href="/login" className="block w-full">
                    <Button variant="outline" className="w-full">
                        Back to Login
                    </Button>
                </Link>
            </CardContent>
        </Card>
    )
}

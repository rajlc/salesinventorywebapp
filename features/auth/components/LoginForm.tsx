"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2 } from "lucide-react"
import { Button, Input, Label, Card, CardHeader, CardTitle, CardContent } from "@/components/ui-shim"
import { useRouter } from "next/navigation"
import { loginAction } from "../actions/loginAction"
import { supabase } from "@/lib/supabase/client"

const formSchema = z.object({
    email: z.string().email({ message: "Invalid email address" }),
    password: z.string().min(6, { message: "Password must be at least 6 characters" }),
})

export function LoginForm() {
    const router = useRouter()
    const [isLoading, setIsLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [showBiometric, setShowBiometric] = React.useState(false) // Left for future use but effectively disabled


    const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true)
        setError(null)

        try {
            console.log('🔐 Calling server action for login...')

            const result = await loginAction(values.email, values.password)

            if (result?.error) {
                console.error('❌ Login error:', result.error)
                setError(result.error)
                setIsLoading(false)
            }
            // If no error, the server action will redirect
        } catch (err) {
            console.error('💥 Caught error:', err)
            setError(err instanceof Error ? err.message : "Something went wrong")
            setIsLoading(false)
        }
    }

    return (
        <>
            <Card className="w-[350px] shadow-lg border-t-4 border-t-blue-500">
                <CardHeader>
                    <CardTitle className="text-2xl text-center">Login</CardTitle>
                    <p className="text-sm text-center text-muted-foreground">
                        Enter your credentials to access the ERP
                    </p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                placeholder="admin@bagmatitraders.com"
                                {...register("email")}
                                disabled={isLoading}
                            />
                            {errors.email && (
                                <p className="text-sm text-red-500">{errors.email.message}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password">Password</Label>
                                <a href="#" className="text-xs text-blue-500 hover:underline">Forgot?</a>
                            </div>
                            <Input
                                id="password"
                                type="password"
                                {...register("password")}
                                disabled={isLoading}
                            />
                            {errors.password && (
                                <p className="text-sm text-red-500">{errors.password.message}</p>
                            )}
                        </div>

                        {error && (
                            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive text-red-600 bg-red-50 border border-red-200">
                                {error}
                            </div>
                        )}



                        <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Sign In
                        </Button>

                        <div className="text-center text-sm text-muted-foreground mt-4">
                            Don't have an account?{" "}
                            <button 
                                type="button" 
                                className="text-blue-500 hover:underline"
                                onClick={() => router.push("/signup")}
                            >
                                Sign Up
                            </button>
                        </div>
                    </form>
                </CardContent>
            </Card>



        </>
    )
}

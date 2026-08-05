"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2 as LoaderIcon } from "lucide-react"
import { Button, Input, Label, Card, CardHeader, CardTitle, CardContent } from "@/components/ui-shim"
import { useRouter } from "next/navigation"
import { signupAction } from "../actions/signupAction"

const signupSchema = z.object({
    fullName: z.string().min(2, { message: "Full name must be at least 2 characters" }),
    email: z.string().email({ message: "Invalid email address" }),
    password: z.string().min(6, { message: "Password must be at least 6 characters" }),
    confirmPassword: z.string().min(6, { message: "Please confirm your password" }),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
})

export function SignupForm() {
    const router = useRouter()
    const [isLoading, setIsLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [isSuccess, setIsSuccess] = React.useState(false)

    const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof signupSchema>>({
        resolver: zodResolver(signupSchema),
    })

    async function onSubmit(values: z.infer<typeof signupSchema>) {
        setIsLoading(true)
        setError(null)

        try {
            const result = await signupAction(values.email, values.password, values.fullName)

            if (result?.error) {
                setError(result.error)
                setIsLoading(false)
            } else {
                setIsSuccess(true)
                setIsLoading(false)
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong")
            setIsLoading(false)
        }
    }

    if (isSuccess) {
        return (
            <Card className="w-[350px] shadow-lg border-t-4 border-t-green-500">
                <CardHeader>
                    <CardTitle className="text-2xl text-center text-green-600">Account Created!</CardTitle>
                    <p className="text-sm text-center text-muted-foreground mt-2">
                        Your account has been created successfully and is now <strong>waiting for Admin approval</strong>.
                    </p>
                </CardHeader>
                <CardContent>
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={() => router.push("/login")}>
                        Go to Login
                    </Button>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="w-[350px] shadow-lg border-t-4 border-t-blue-500">
            <CardHeader>
                <CardTitle className="text-2xl text-center">Sign Up</CardTitle>
                <p className="text-sm text-center text-muted-foreground">
                    Create a new account for Bagmati Traders ERP
                </p>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name</Label>
                        <Input
                            id="fullName"
                            placeholder="John Doe"
                            {...register("fullName")}
                            disabled={isLoading}
                        />
                        {errors.fullName && (
                            <p className="text-sm text-red-500">{errors.fullName.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            placeholder="user@example.com"
                            {...register("email")}
                            disabled={isLoading}
                        />
                        {errors.email && (
                            <p className="text-sm text-red-500">{errors.email.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
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

                    <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm Password</Label>
                        <Input
                            id="confirmPassword"
                            type="password"
                            {...register("confirmPassword")}
                            disabled={isLoading}
                        />
                        {errors.confirmPassword && (
                            <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>
                        )}
                    </div>

                    {error && (
                        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive text-red-600 bg-red-50 border border-red-200">
                            {error}
                        </div>
                    )}

                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={isLoading}>
                        {isLoading && <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />}
                        Create Account
                    </Button>

                    <div className="text-center text-sm text-muted-foreground mt-4">
                        Already have an account?{" "}
                        <button 
                            type="button" 
                            className="text-blue-500 hover:underline"
                            onClick={() => router.push("/login")}
                        >
                            Sign In
                        </button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}

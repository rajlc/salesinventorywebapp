import { LoginForm } from "@/features/auth/components/LoginForm"
import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Login | Bagmati Traders",
    description: "Login to the inventory system",
}

export default function LoginPage() {
    return <LoginForm />
}

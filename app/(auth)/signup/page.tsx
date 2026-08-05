import { SignupForm } from "@/features/auth/components/SignupForm"
import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Sign Up | Bagmati Traders",
    description: "Create an account for the inventory system",
}

export default function SignupPage() {
    return <SignupForm />
}

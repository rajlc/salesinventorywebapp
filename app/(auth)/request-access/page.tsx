import { SignupRequestForm } from "@/features/auth/components/SignupRequestForm"
import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Request Access | Bagmati Traders",
    description: "Request access to the system",
}

export default function RequestAccessPage() {
    return <SignupRequestForm />
}

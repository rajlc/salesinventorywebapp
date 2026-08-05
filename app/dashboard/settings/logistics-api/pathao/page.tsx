import { PathaoSettingsForm } from '@/features/settings/logistics-api/components/pathao-settings-form'
import { getPathaoSettings } from '@/features/settings/logistics-api/actions'

export default async function PathaoSettingsPage() {
    const settings = await getPathaoSettings()

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h1 className="text-3xl font-bold">Pathao Courier API</h1>
                <p className="text-muted-foreground">Configure your Pathao Merchant API credentials</p>
            </div>

            <PathaoSettingsForm initialSettings={settings} />
        </div>
    )
}

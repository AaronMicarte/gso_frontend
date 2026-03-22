import { UserSettingsPage } from '@/components/features/settings/UserSettingsPage';

export default function StaffSettingsPage() {
    return (
        <UserSettingsPage
            baseRoute="/staff"
            roleLabel="GSO Staff"
            landingOptions={[
                { label: 'Staff Dashboard', route: '/staff/dashboard' },
                { label: 'Inventory', route: '/staff/inventory' },
                { label: 'Issuance Requests', route: '/staff/issuance' },
                { label: 'Delivery Receipts', route: '/staff/delivery-receipts' },
            ]}
        />
    );
}

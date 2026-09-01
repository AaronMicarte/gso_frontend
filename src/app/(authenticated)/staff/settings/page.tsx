import { UserSettingsPage } from '@/components/features/settings/UserSettingsPage';

export default function StaffSettingsPage() {
    return (
        <UserSettingsPage
            baseRoute="/staff"
            roleLabel="GSO Staff"
            landingOptions={[
                { label: 'Staff Dashboard', route: '/staff/dashboard' },
                { label: 'Inventory', route: '/staff/inventory' },
                { label: 'Property Issuance', route: '/staff/issuance' },
                { label: 'Delivery Receipts', route: '/staff/delivery-receipts' },
                { label: 'Property Transfers', route: '/staff/transfer' },
                { label: 'Property Borrow', route: '/staff/borrow' },
            ]}
        />
    );
}

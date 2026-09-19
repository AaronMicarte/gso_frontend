import { UserSettingsPage } from '@/components/features/settings/UserSettingsPage';

export default function AdminSettingsPage() {
    return (
        <UserSettingsPage
            baseRoute="/admin"
            roleLabel="Admin"
            landingOptions={[
                { label: 'Admin Dashboard', route: '/admin/dashboard' },
                { label: 'Inventory', route: '/admin/inventory' },
                { label: 'User Management', route: '/admin/users' },
                { label: 'Delivery Receipts', route: '/admin/delivery-receipts' },
                { label: 'Property Issuance', route: '/admin/issuance' },
                { label: 'Property Transfers', route: '/admin/transfer' },
                { label: 'Property Borrow', route: '/admin/borrow' },
            ]}
        />
    );
}

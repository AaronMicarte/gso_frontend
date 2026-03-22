import { UserSettingsPage } from '@/components/features/settings/UserSettingsPage';

export default function AdminSettingsPage() {
    return (
        <UserSettingsPage
            baseRoute="/admin"
            roleLabel="Admin"
            landingOptions={[
                { label: 'Admin Dashboard', route: '/admin/dashboard' },
                { label: 'User Management', route: '/admin/users' },
                { label: 'Security Center', route: '/admin/security' },
                { label: 'Delivery Receipts', route: '/admin/delivery-receipts' },
            ]}
        />
    );
}

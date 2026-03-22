import { UserSettingsPage } from '@/components/features/settings/UserSettingsPage';

export default function DepartmentHeadSettingsPage() {
    return (
        <UserSettingsPage
            baseRoute="/department_head"
            roleLabel="Department Head"
            landingOptions={[
                { label: 'Department Dashboard', route: '/department_head/dashboard' },
                { label: 'Received Items', route: '/department_head/received-items' },
                { label: 'Property Transfers', route: '/department_head/transfer' },
                { label: 'Borrow Requests', route: '/department_head/borrow' },
            ]}
        />
    );
}

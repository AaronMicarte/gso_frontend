import { UserRolesPage } from '@/components/features/masterdata/user-roles/UserRolesPage';

export default function StaffUserRolesPage() {
    return <UserRolesPage baseRoute="/staff" canEdit={true} canDelete={true} />;
}
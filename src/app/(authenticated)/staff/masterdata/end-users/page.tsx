import { EndUsersPage } from '@/components/features/masterdata/end-users/EndUsersPage';

export default function StaffEndUsersPage() {
    return <EndUsersPage baseRoute="/staff" canEdit={true} canDelete={true} />;
}
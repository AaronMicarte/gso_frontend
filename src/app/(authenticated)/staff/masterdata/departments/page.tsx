import { DepartmentsPage } from '@/components/features/masterdata/departments/DepartmentsPage';

export default function StaffDepartmentsPage() {
    return <DepartmentsPage baseRoute="/staff" canEdit={true} canDelete={true} />;
}
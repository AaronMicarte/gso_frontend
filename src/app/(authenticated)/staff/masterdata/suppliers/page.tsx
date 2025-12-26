import { SuppliersPage } from '@/components/features/masterdata/suppliers/SuppliersPage';

export default function StaffSuppliersPage() {
    return <SuppliersPage baseRoute="/staff" canEdit={true} canDelete={true} />;
}
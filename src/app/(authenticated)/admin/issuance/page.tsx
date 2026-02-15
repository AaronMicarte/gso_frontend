import { IssuanceListPage } from '@/components/features/issuance';

export default function AdminIssuancePage() {
    return <IssuanceListPage baseRoute="/admin/issuance" isAdmin={true} />;
}
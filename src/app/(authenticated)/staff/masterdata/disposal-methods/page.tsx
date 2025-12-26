import { DisposalMethodsPage } from '@/components/features/masterdata/disposal-methods/DisposalMethodsPage';

export default function StaffDisposalMethodsPage() {
    return <DisposalMethodsPage baseRoute="/staff" canEdit={true} canDelete={true} />;
}
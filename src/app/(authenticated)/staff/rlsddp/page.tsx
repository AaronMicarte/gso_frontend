import { RlsddpListPage } from '@/components/features/rlsddp';

export default function StaffRlsddpPage() {
    return (
        <RlsddpListPage
            baseRoute="/staff/rlsddp"
            pageTitle="Report of Lost, Stolen, Damaged or Destroyed Property (RLSDDP)"
            pageDescription="Manage and review incident reports for lost, stolen, damaged, or destroyed assets."
        />
    );
}

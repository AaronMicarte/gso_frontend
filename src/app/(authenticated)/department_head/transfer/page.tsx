import { TransferListPage } from '@/components/features/transfer';

export default function DepartmentHeadTransferPage() {
    return (
        <TransferListPage
            baseRoute="/department_head/transfer"
            scope="outgoing"
            pageTitle="Transfer Records"
            pageDescription="View transfer records involving your department"
            showCreate={false}
        />
    );
}

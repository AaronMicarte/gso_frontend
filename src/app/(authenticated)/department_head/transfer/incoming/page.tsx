import { TransferListPage } from '@/components/features/transfer';

export default function DepartmentHeadIncomingTransferPage() {
    return (
        <TransferListPage
            baseRoute="/department_head/transfer"
            scope="incoming"
            pageTitle="Incoming Transfers"
            pageDescription="Review transfer requests sent to your department"
            showCreate={false}
        />
    );
}

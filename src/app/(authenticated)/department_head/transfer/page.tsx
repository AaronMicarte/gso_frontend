import { TransferListPage } from '@/components/features/transfer';

export default function DepartmentHeadTransferPage() {
    return (
        <TransferListPage
            baseRoute="/department_head/transfer"
            scope="outgoing"
            pageTitle="Transfer Requests"
            pageDescription="Track transfers you requested"
            showCreate={true}
        />
    );
}

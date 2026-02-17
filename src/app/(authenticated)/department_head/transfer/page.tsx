import { TransferListPage } from '@/components/features/transfer';

export default function DepartmentHeadTransferPage() {
    return (
        <TransferListPage
            baseRoute="/department_head/transfer"
            scope="outgoing"
            pageTitle="My Requests"
            pageDescription="Track transfer requests you created"
            showCreate={true}
        />
    );
}

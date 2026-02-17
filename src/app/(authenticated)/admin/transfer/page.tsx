import { TransferListPage } from '@/components/features/transfer';

export default function AdminTransferPage() {
    return (
        <TransferListPage
            baseRoute="/admin/transfer"
            pageTitle="Property Transfers"
            pageDescription="Review and manage inter-department transfer requests"
        />
    );
}

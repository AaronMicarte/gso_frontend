import { TransferListPage } from '@/components/features/transfer';

export default function StaffTransferPage() {
    return (
        <TransferListPage
            baseRoute="/staff/transfer"
            pageTitle="Property Transfers"
            pageDescription="Review and process transfer requests"
        />
    );
}

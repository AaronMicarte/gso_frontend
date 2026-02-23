import { BorrowListPage } from '@/components/features/borrow';

export default function AdminBorrowPage() {
    return (
        <BorrowListPage
            baseRoute="/admin/borrow"
            pageTitle="Property Borrowing"
            pageDescription="Review and manage temporary borrow requests"
        />
    );
}

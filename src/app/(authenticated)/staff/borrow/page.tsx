import { BorrowListPage } from '@/components/features/borrow';

export default function StaffBorrowPage() {
    return (
        <BorrowListPage
            baseRoute="/staff/borrow"
            pageTitle="Property Borrowing"
            pageDescription="Review and process borrow requests"
        />
    );
}

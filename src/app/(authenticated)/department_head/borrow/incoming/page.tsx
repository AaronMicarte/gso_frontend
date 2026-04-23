import { BorrowListPage } from '@/components/features/borrow';

export default function DepartmentHeadIncomingBorrowPage() {
    return (
        <BorrowListPage
            baseRoute="/department_head/borrow"
            scope="incoming"
            pageTitle="Incoming Borrow Requests"
            pageDescription="Review borrow requests sent to your department"
            showCreate={false}
        />
    );
}

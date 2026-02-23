import { BorrowListPage } from '@/components/features/borrow';

export default function DepartmentHeadBorrowPage() {
    return (
        <BorrowListPage
            baseRoute="/department_head/borrow"
            scope="outgoing"
            pageTitle="My Borrow Requests"
            pageDescription="Track borrow requests you created"
            showCreate={true}
        />
    );
}

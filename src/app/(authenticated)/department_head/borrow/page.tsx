import { BorrowListPage } from '@/components/features/borrow';

export default function DepartmentHeadBorrowPage() {
    return (
        <BorrowListPage
            baseRoute="/department_head/borrow"
            scope="outgoing"
            pageTitle="Borrow Records"
            pageDescription="View borrow records involving your department"
            showCreate={false}
        />
    );
}

import { ServiceRecordsPage } from '@/components/features/service';

export default function DepartmentHeadServiceRecordsPage() {
    return (
        <ServiceRecordsPage
            baseRoute="/department_head/service-records"
            title="Department Service Records"
            description="View status of service and repair requests in your department"
            showCreate={false}
        />
    );
}

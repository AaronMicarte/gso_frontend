import { ServiceRecordsPage } from '@/components/features/service';

export default function AdminServiceRecordsPage() {
    return (
        <ServiceRecordsPage
            baseRoute="/admin/service-records"
            title="Service & Repair Records"
            description="Manage repair/service lifecycle and cost traceability"
            showCreate={true}
        />
    );
}

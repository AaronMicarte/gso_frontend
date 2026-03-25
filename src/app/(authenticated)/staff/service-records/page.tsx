import { ServiceRecordsPage } from '@/components/features/service';

export default function StaffServiceRecordsPage() {
    return (
        <ServiceRecordsPage
            baseRoute="/staff/service-records"
            title="Service & Repair Records"
            description="Handle repair progress, vendors, and verification"
            showCreate={true}
        />
    );
}

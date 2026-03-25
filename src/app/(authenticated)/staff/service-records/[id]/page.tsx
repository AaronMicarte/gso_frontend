import { use } from 'react';
import { ServiceRecordDetailPage } from '@/components/features/service';

export default function StaffServiceRecordDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolved = use(params);
    return <ServiceRecordDetailPage baseRoute="/staff/service-records" recordId={parseInt(resolved.id, 10)} canEdit={true} />;
}

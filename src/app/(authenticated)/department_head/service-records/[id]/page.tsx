import { use } from 'react';
import { ServiceRecordDetailPage } from '@/components/features/service';

export default function DepartmentHeadServiceRecordDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolved = use(params);
    return <ServiceRecordDetailPage baseRoute="/department_head/service-records" recordId={parseInt(resolved.id, 10)} canEdit={false} />;
}

import { use } from 'react';
import { ServiceRecordDetailPage } from '@/components/features/service';

export default function AdminServiceRecordDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolved = use(params);
    return <ServiceRecordDetailPage baseRoute="/admin/service-records" recordId={parseInt(resolved.id, 10)} canEdit={true} />;
}

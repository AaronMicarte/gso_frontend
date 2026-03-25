import { use } from 'react';
import { ServiceRecordFormPage } from '@/components/features/service';

export default function AdminEditServiceRecordPage({ params }: { params: Promise<{ id: string }> }) {
    const resolved = use(params);
    return <ServiceRecordFormPage baseRoute="/admin/service-records" recordId={parseInt(resolved.id, 10)} />;
}

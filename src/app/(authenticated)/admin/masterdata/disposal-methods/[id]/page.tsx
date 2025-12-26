import { use } from 'react';
import { DisposalMethodFormPage } from '@/components/features/masterdata/disposal-methods/DisposalMethodFormPage';

export default function EditDisposalMethodPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    return <DisposalMethodFormPage baseRoute="/admin" disposalMethodId={parseInt(resolvedParams.id)} />;
}
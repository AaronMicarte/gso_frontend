import { use } from 'react';
import { EndUserFormPage } from '@/components/features/masterdata/end-users/EndUserFormPage';

export default function EditEndUserPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    return <EndUserFormPage baseRoute="/admin" endUserId={parseInt(resolvedParams.id)} />;
}

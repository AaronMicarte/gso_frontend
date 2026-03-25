import { CreateIssuancePage } from '@/components/features/issuance';
import { Suspense } from 'react';

export default function AdminCreateIssuancePage() {
    return (
        <Suspense fallback={<div className="p-6">Loading...</div>}>
            <CreateIssuancePage baseRoute="/admin/issuance" />
        </Suspense>
    );
}
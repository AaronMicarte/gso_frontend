import { AllItemsPage } from '@/components/features/inventory/AllItemsPage';
import { Suspense } from 'react';

export default function Page() {
    return (
        <Suspense fallback={<div className="p-6">Loading...</div>}>
            <AllItemsPage />
        </Suspense>
    );
}
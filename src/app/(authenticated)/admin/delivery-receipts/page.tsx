import { Suspense } from 'react';
import { DeliveryReceiptsPage } from '@/components/features/delivery-receipts/DeliveryReceiptsPage';

export default function AdminDeliveryReceiptsPage() {
    return (
        <Suspense fallback={null}>
            <DeliveryReceiptsPage baseRoute="/admin" canDelete={true} />
        </Suspense>
    );
}

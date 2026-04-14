import { Suspense } from 'react';
import { DeliveryReceiptsPage } from '@/components/features/delivery-receipts/DeliveryReceiptsPage';

export default function StaffDeliveryReceiptsPage() {
    return (
        <Suspense fallback={null}>
            <DeliveryReceiptsPage baseRoute="/staff" canDelete={false} />
        </Suspense>
    );
}

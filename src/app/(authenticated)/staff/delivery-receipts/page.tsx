import { DeliveryReceiptsPage } from '@/components/features/delivery-receipts/DeliveryReceiptsPage';

export default function StaffDeliveryReceiptsPage() {
    return <DeliveryReceiptsPage baseRoute="/staff" canDelete={false} />;
}

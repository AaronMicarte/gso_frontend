import { DeliveryReceiptsPage } from '@/components/features/delivery-receipts/DeliveryReceiptsPage';

export default function AdminDeliveryReceiptsPage() {
    return <DeliveryReceiptsPage baseRoute="/admin" canDelete={true} />;
}

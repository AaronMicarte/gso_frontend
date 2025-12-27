import { Suspense } from 'react';
import { CreateIARPage } from '@/components/features/delivery-receipts/CreateIARPage';
import { Loader2 } from 'lucide-react';

export default function AdminCreateIARPage() {
    return (
        <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>}>
            <CreateIARPage baseRoute="/admin" />
        </Suspense>
    );
}

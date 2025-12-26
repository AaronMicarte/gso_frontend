import { use } from 'react';
import { SupplierFormPage } from '@/components/features/masterdata/suppliers/SupplierFormPage';

export default function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    return <SupplierFormPage baseRoute="/admin" supplierId={parseInt(resolvedParams.id)} />;
}
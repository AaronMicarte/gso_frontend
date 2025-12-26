import { use } from 'react';
import { UnitOfMeasureFormPage } from '@/components/features/masterdata/units-of-measure/UnitOfMeasureFormPage';

export default function EditUnitOfMeasurePage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    return <UnitOfMeasureFormPage baseRoute="/admin" unitId={parseInt(resolvedParams.id)} />;
}
import { use } from 'react';
import { DepartmentFormPage } from '@/components/features/masterdata/departments/DepartmentFormPage';

export default function EditDepartmentPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    return <DepartmentFormPage baseRoute="/admin" departmentId={parseInt(resolvedParams.id)} />;
}
import { ArticlesFormPage } from '@/components/features/masterdata/articles';
import { Suspense } from 'react';

export default function AdminArticlesFormPage() {
    return (
        <Suspense fallback={<div className="p-6">Loading...</div>}>
            <ArticlesFormPage baseRoute="/admin/masterdata/articles" />
        </Suspense>
    );
}
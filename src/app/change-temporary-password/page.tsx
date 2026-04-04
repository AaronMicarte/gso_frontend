import ChangeTemporaryPasswordPage from '@/components/features/auth/ChangeTemporaryPasswordPage';
import { Suspense } from 'react';

export default function Page() {
    return (
        <Suspense fallback={<div className="p-6 text-sm text-slate-600">Loading...</div>}>
            <ChangeTemporaryPasswordPage />
        </Suspense>
    );
}

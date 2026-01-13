import { Suspense } from 'react';
import ActivateAccountPage from '@/components/features/auth/ActivateAccountPage';

export default function Page() {
    return (
        <Suspense fallback={<div className="p-6">Loading...</div>}>
            <ActivateAccountPage />
        </Suspense>
    );
}

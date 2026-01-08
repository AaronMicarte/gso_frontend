'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { ViewAssetRequestPage } from '@/components/features/asset-requests/ViewAssetRequestPage';

export default function DepartmentHeadViewAssetRequestPage() {
    const { user } = useAuth();

    // Department heads can cancel their own requests if they're pending
    const canCancel = user?.UserRoleID === 4; // Department Head role

    return (
        <ViewAssetRequestPage
            baseRoute="/department_head"
            canCancel={canCancel}
        />
    );
}
'use client';

import { ViewAssetRequestPage } from '@/components/features/asset-requests/ViewAssetRequestPage';

export default function AdminViewAssetRequestPage() {
    return (
        <ViewAssetRequestPage
            baseRoute="/admin"
            isAdmin={true}
        />
    );
}
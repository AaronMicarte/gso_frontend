'use client';

import { AssetRequestsPage } from '@/components/features/asset-requests/AssetRequestsPage';

export default function AdminAssetRequestsPage() {
    return (
        <AssetRequestsPage
            baseRoute="/admin"
            isAdmin={true}
        />
    );
}
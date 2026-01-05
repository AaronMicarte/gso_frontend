import { AssetRequestsPage } from '@/components/features/asset-requests/AssetRequestsPage';

export default function DepartmentHeadAssetRequestsPage() {
    return <AssetRequestsPage baseRoute="/department_head" canCreate={true} />;
}
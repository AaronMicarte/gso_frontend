import { PropertyWastePage } from '@/components/features/property-waste';

export default function AdminPropertyWastePage() {
    return (
        <PropertyWastePage
            title="Property Waste"
            description="Track unserviceable assets and assign disposal methods based on GSO disposal workflow"
            canManage={true}
        />
    );
}

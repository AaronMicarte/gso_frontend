import { PropertyWastePage } from '@/components/features/property-waste';

export default function StaffPropertyWastePage() {
    return (
        <PropertyWastePage
            title="Property Waste"
            description="Prepare disposal actions for unserviceable assets from service records"
            canManage={true}
        />
    );
}

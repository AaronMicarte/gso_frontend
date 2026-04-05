import { PropertyWastePage } from '@/components/features/property-waste';

export default function DepartmentHeadPropertyWastePage() {
    return (
        <PropertyWastePage
            title="Department Property Waste"
            description="Review unserviceable assets and disposal method assignments for your department"
            canManage={false}
        />
    );
}

import { UnitsOfMeasurePage } from '@/components/features/masterdata/units-of-measure/UnitsOfMeasurePage';

export default function StaffUnitsOfMeasurePage() {
    return <UnitsOfMeasurePage baseRoute="/staff" canEdit={true} canDelete={true} />;
}
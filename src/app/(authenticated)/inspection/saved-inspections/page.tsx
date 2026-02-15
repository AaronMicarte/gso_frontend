import { InspectionReportListPage } from '@/components/features/inspection/InspectionReportListPage';

export default function SavedInspectionsPage() {
    return (
        <InspectionReportListPage
            baseRoute="/inspection"
            status="pending"
            title="Saved Inspections"
            subtitle="Draft inspections waiting for completion"
        />
    );
}

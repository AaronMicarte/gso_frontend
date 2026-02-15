import { InspectionReportListPage } from '@/components/features/inspection/InspectionReportListPage';

export default function CompletedInspectionsPage() {
    return (
        <InspectionReportListPage
            baseRoute="/inspection"
            status="inspected"
            title="Completed Inspections"
            subtitle="Inspections completed and pending acceptance"
        />
    );
}

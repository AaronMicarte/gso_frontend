import { redirect } from 'next/navigation';

export default function InspectionReportDetailRedirect({ params }: { params: { id: string } }) {
    // preserve old URLs by redirecting to the new canonical route
    redirect(`/inspection/reports/${params.id}`);
}

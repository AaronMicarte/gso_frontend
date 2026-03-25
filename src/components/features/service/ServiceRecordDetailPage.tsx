'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { toast } from 'sonner';

import serviceApi from '@/lib/api/assetServices';
import { AssetServiceRecord } from '@/types/assetService';

interface ServiceRecordDetailPageProps {
    baseRoute: string;
    recordId: number;
    canEdit?: boolean;
}

const formatDateReported = (dateString?: string | null): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    const zonedDate = toZonedTime(date, 'Asia/Manila');
    return format(zonedDate, 'MMMM d, yyyy');
};

const formatReportingDepartment = (record: AssetServiceRecord): string => {
    const head = record.reportingDepartmentHead?.trim();
    const dept = record.reportingDepartmentLabel?.trim()
        || record.reportingDepartment?.DepartmentCode?.trim()
        || record.reportingDepartment?.DepartmentName?.trim();

    if (head && dept) return `${head} - ${dept}`;
    if (dept) return dept;
    if (head) return head;
    return '-';
};

export function ServiceRecordDetailPage({ baseRoute, recordId, canEdit = false }: ServiceRecordDetailPageProps) {
    const [record, setRecord] = useState<AssetServiceRecord | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const run = async () => {
            try {
                setLoading(true);
                const data = await serviceApi.getById(recordId);
                setRecord(data);
            } catch {
                toast.error('Failed to load service record');
            } finally {
                setLoading(false);
            }
        };

        run();
    }, [recordId]);

    if (loading) {
        return <div className="p-6">Loading...</div>;
    }

    if (!record) {
        return <div className="p-6">Service record not found.</div>;
    }

    return (
        <div className="min-h-screen bg-app print:hidden p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <Link href={baseRoute} className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 text-sm mb-2">
                        <ArrowLeft className="w-4 h-4" />
                        Back to service records
                    </Link>
                    <h1 className="text-2xl font-bold text-slate-900">{record.ServiceNumber}</h1>
                    <p className="text-sm text-slate-500">Reported on {formatDateReported(record.DateReported)}</p>
                </div>
                {canEdit && (
                    <Link href={`${baseRoute}/${record.ServiceRecordID}/edit`} className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)]">
                        <Edit className="w-4 h-4" />
                        Edit
                    </Link>
                )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <h2 className="text-lg font-semibold text-slate-800 mb-3">Header</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div><span className="text-slate-500">Status:</span> {record.Status.replaceAll('_', ' ')}</div>
                    <div><span className="text-slate-500">Reporting Department:</span> {formatReportingDepartment(record)}</div>
                </div>
                {record.RecordNotes && <p className="mt-3 text-sm text-slate-700">{record.RecordNotes}</p>}
            </div>

            <div className="space-y-4">
                {record.details.map((detail) => (
                    <div key={detail.ServiceRecordDetailID} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                        <h3 className="text-base font-semibold text-slate-800 mb-2">Item Detail #{detail.ServiceRecordDetailID}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                            <div><span className="text-slate-500">Property No:</span> {detail.PropertyNumber || '-'}</div>
                            <div><span className="text-slate-500">Item:</span> {detail.ItemDescription || '-'}</div>
                            <div><span className="text-slate-500">Status:</span> {detail.Status.replaceAll('_', ' ')}</div>
                            <div><span className="text-slate-500">Budget:</span> {detail.BudgetStatus.replaceAll('_', ' ')}</div>
                            <div><span className="text-slate-500">Provider:</span> {detail.assigned_provider_name || '-'}</div>
                            <div><span className="text-slate-500">Handling:</span> {detail.HandlingDecision?.replaceAll('_', ' ') || '-'}</div>
                        </div>
                        <p className="mt-3 text-sm text-slate-700"><span className="text-slate-500">Issue:</span> {detail.ProblemDescription}</p>
                        {detail.invoice_url && (
                            <a href={detail.invoice_url} target="_blank" rel="noreferrer" className="inline-block mt-2 text-sm text-blue-600 hover:underline">
                                View Invoice
                            </a>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default ServiceRecordDetailPage;

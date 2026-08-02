'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit, Building2, User, Calendar, CheckCircle, XCircle, FileText, FileSpreadsheet, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { rlsddpAPI } from '@/lib/api/rlsddp';
import { PropertyRlsddpReport, RlsddpStatus } from '@/types/propertyRlsddp';
import { exportRlsddpToExcel } from './RlsddpExport';

interface RlsddpDetailPageProps {
    baseRoute: string;
    reportId?: number;
    isModal?: boolean;
    onClose?: () => void;
}

const statusBadgeStyles: Record<RlsddpStatus, string> = {
    Lost: 'bg-amber-100 text-amber-800',
    Stolen: 'bg-rose-100 text-rose-800',
    Damaged: 'bg-orange-100 text-orange-800',
    Destroyed: 'bg-red-100 text-red-800',
};

export function RlsddpDetailPage({ baseRoute, reportId, isModal = false, onClose }: RlsddpDetailPageProps) {
    const params = useParams();
    const router = useRouter();

    const [report, setReport] = useState<PropertyRlsddpReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);

    const resolvedId = reportId ?? (params?.id ? Number(params.id) : null);

    const fetchReport = useCallback(async () => {
        if (!resolvedId) return;
        try {
            setLoading(true);
            const data = await rlsddpAPI.getReport(resolvedId);
            setReport(data);
        } catch {
            toast.error('Failed to load RLSDDP details');
            if (isModal) {
                onClose?.();
            } else {
                router.push(baseRoute);
            }
        } finally {
            setLoading(false);
        }
    }, [resolvedId, isModal, onClose, router, baseRoute]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    const handleExcelExport = async () => {
        if (!report) return;
        try {
            setIsExporting(true);
            await exportRlsddpToExcel(report);
            toast.success('RLSDDP exported successfully');
        } catch (err) {
            toast.error('Failed to export RLSDDP');
            console.error(err);
        } finally {
            setIsExporting(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Loading RLSDDP report...</div>;
    }

    if (!report) {
        return <div className="p-8 text-center text-slate-500">RLSDDP report not found.</div>;
    }

    const createdBy = report.createdBy ?? report.created_by ?? null;
    const createdByName = createdBy?.FullName?.trim() || 'Unknown user';

    const content = (
        <div className="space-y-6 w-full">
            {/* Header section matching ViewDRPage */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div className="flex items-center gap-3">
                    {!isModal && (
                        <Link
                            href={baseRoute}
                            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                    )}
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-slate-900">{report.RlsddpNumber}</h1>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadgeStyles[report.Status] || 'bg-slate-100 text-slate-800'}`}>
                                {report.Status}
                            </span>
                        </div>
                        <p className="text-slate-500 text-sm mt-0.5">
                            Created on {format(toZonedTime(new Date(report.created_at), 'Asia/Manila'), 'MMM dd, yyyy')} by {createdByName}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExcelExport}
                        disabled={isExporting}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50 border border-green-200 rounded-lg shadow-sm transition-colors"
                    >
                        {isExporting ? (
                            <>
                                <span className="animate-spin h-4 w-4 border-2 border-green-600 border-t-transparent rounded-full" />
                                Exporting...
                            </>
                        ) : (
                            <>
                                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                                Export Excel
                            </>
                        )}
                    </button>
                    <Link
                        href={`${baseRoute}/${report.RlsddpID}/edit`}
                        className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors text-sm font-medium"
                    >
                        <Edit className="w-4 h-4" />
                        Edit Report
                    </Link>
                    {isModal && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* General Info Grid */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                    <span className="text-slate-400 text-xs block">Department</span>
                    <div className="font-semibold text-slate-900 flex items-center gap-1.5 mt-0.5">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        {report.department?.DepartmentName || 'N/A'}
                    </div>
                </div>

                <div>
                    <span className="text-slate-400 text-xs block">Accountable Officer</span>
                    <div className="font-semibold text-slate-900 flex items-center gap-1.5 mt-0.5">
                        <User className="w-4 h-4 text-slate-400" />
                        {report.AccountableOfficer}
                    </div>
                </div>

                <div>
                    <span className="text-slate-400 text-xs block">Police Notified</span>
                    <div className="font-semibold text-slate-900 mt-0.5">
                        {report.PoliceNotified ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-semibold">
                                <CheckCircle className="w-3.5 h-3.5" />
                                Yes {report.PoliceStation ? `(${report.PoliceStation})` : ''}
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 text-slate-500 text-xs font-semibold">
                                <XCircle className="w-3.5 h-3.5" />
                                No
                            </span>
                        )}
                    </div>
                </div>

                {report.PoliceNotified && report.DateReported && (
                    <div>
                        <span className="text-slate-400 text-xs block">Date Reported to Police</span>
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5 mt-0.5">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            {format(toZonedTime(new Date(report.DateReported), 'Asia/Manila'), 'MMM dd, yyyy')}
                        </div>
                    </div>
                )}
            </div>

            {report.Remarks && (
                <div className="bg-white p-4 rounded-xl border border-slate-200 text-sm">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Circumstances / Remarks</span>
                    <p className="text-slate-800">{report.Remarks}</p>
                </div>
            )}

            {/* Line Items Table */}
            <div className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[var(--primary)]" />
                    Reported Assets ({report.items?.length || 0})
                </h3>

                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3">Property No.</th>
                                <th className="px-4 py-3 text-right">Acquisition Cost</th>
                                <th className="px-4 py-3">Generated Description</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {report.items?.map((item) => (
                                <tr key={item.RlsddpItemID} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 font-semibold text-slate-900">
                                        {item.PropertyNumber || 'N/A'}
                                    </td>
                                    <td className="px-4 py-3 text-right font-medium text-slate-900">
                                        ₱{Number(item.AcquisitionCost).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-4 py-3 text-slate-700">
                                        {item.Description}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    if (isModal) {
        return content;
    }

    return (
        <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}>
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm w-full">
                    {content}
                </div>
            </div>
        </div>
    );
}
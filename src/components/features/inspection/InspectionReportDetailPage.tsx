'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { getInspectionReport } from '@/lib/api/inspection';
import { InspectionReport } from '@/types/inspection';
import { toast } from 'sonner';

interface InspectionReportDetailPageProps {
    baseRoute: string;
    reportId?: number;
    isModal?: boolean;
    onClose?: () => void;
}

export function InspectionReportDetailPage({ baseRoute, reportId, isModal = false, onClose }: InspectionReportDetailPageProps) {
    const params = useParams();
    const router = useRouter();
    const [report, setReport] = useState<InspectionReport | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const resolvedId = reportId ?? (params.id ? parseInt(params.id as string, 10) : null);

    useEffect(() => {
        const fetchReport = async () => {
            try {
                if (!resolvedId) return;
                const data = await getInspectionReport(resolvedId);
                setReport(data);
            } catch {
                toast.error('Failed to load inspection report');
                if (isModal) {
                    onClose?.();
                } else {
                    router.push(`${baseRoute}/inspections`);
                }
            } finally {
                setIsLoading(false);
            }
        };

        if (resolvedId) {
            fetchReport();
        }
    }, [resolvedId, router, baseRoute, isModal, onClose]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundAttachment: 'fixed' }}>
                <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
            </div>
        );
    }

    if (!report) return null;

    const inspectedDate = format(toZonedTime(new Date(report.DateInspected), 'Asia/Manila'), 'MMM dd, yyyy');
    const receipt = report.deliveryReceipt || report.delivery_receipt;

    return (
        <div className={isModal ? 'print:hidden' : 'min-h-screen bg-cover bg-center bg-no-repeat print:hidden'} style={isModal ? undefined : { backgroundImage: "url('/assets/images/background/bg.jpg')" }}>
            <div className="p-6 max-w-6xl mx-auto space-y-6">
                <div className="flex items-center gap-4">
                    {isModal ? (
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                        >
                            <ArrowLeft className="w-6 h-6 text-slate-600" />
                        </button>
                    ) : (
                        <Link
                            href={`${baseRoute}/inspections`}
                            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                        >
                            <ArrowLeft className="w-6 h-6 text-slate-600" />
                        </Link>
                    )}
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Inspection Report</h1>
                        <p className="text-slate-500 text-sm">{report.IARNumber || `IAR-${report.IARID}`}</p>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Delivery Receipt</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-700">
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-400">DR Number</p>
                            <p className="font-medium">{receipt?.DRNumber || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-400">Supplier</p>
                            <p className="font-medium">{receipt?.SupplierName || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-400">PO Number</p>
                            <p className="font-medium">{receipt?.PONumber || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-400">Date Inspected</p>
                            <p className="font-medium">{inspectedDate}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-400">Inspector</p>
                            <p className="font-medium">{report.inspectedByUser?.FullName || report.inspected_by_user?.FullName || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-400">Status</p>
                            <p className="font-medium capitalize">{report.Status}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Inspection Items</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-500">
                                <tr>
                                    <th className="text-left px-4 py-3">Item</th>
                                    <th className="text-left px-4 py-3">Quantity</th>
                                    <th className="text-left px-4 py-3">Results</th>
                                    <th className="text-left px-4 py-3">Remarks</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {report.details?.map((item) => {
                                    const detail = item.drDetail || item.dr_detail;
                                    const unit = item.drDetail?.unitOfMeasure || item.dr_detail?.unit_of_measure;
                                    const propertyType = item.drDetail?.propertyType || item.dr_detail?.property_type;
                                    return (
                                        <tr key={item.IARDetailID}>
                                            <td className="px-4 py-3 text-slate-700">
                                                <div className="font-medium">{detail?.ItemDescription || 'N/A'}</div>
                                                <div className="text-xs text-slate-500">{propertyType?.PropertyName || ''}</div>
                                                <div className="text-xs text-slate-500 mt-1">
                                                    Brand: {item.VerifiedBrand || detail?.Brand || '—'} | Model: {item.VerifiedModel || detail?.ModelNumber || '—'} | SN: {item.NoSerial ? 'No serial' : (item.VerifiedSerial || detail?.SerialNumber || '—')}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">
                                                {detail?.QuantityDelivered} {unit?.UnitName || ''}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-xs text-slate-600">Accepted: {item.QuantityAccepted}</div>
                                                <div className="text-xs text-slate-600">Rejected: {item.QuantityRejected}</div>
                                                <div className="text-xs text-slate-500">Condition: {item.condition?.ConditionName || 'N/A'}</div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">{item.Remarks || '—'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

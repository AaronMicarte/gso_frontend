'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit, AlertCircle, Download, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { getDeliveryReceipt } from '@/lib/api/deliveryReceipts';
import issuanceAPI from '@/lib/api/issuance';
import { getRis } from '@/lib/api/ris';
import { DeliveryReceipt } from '@/types/procurement';
import { toast } from 'sonner';
import { useAuth } from '@/lib/hooks/useAuth';
import { exportIARToExcel } from '@/components/features/delivery-receipts/IARExport';
import { formatAssignmentPositionDisplay } from '@/lib/deliveryReceiptAssignments';
import { exportPARToExcel } from '@/components/features/issuance/PARExport';
import { exportICSToExcel } from '@/components/features/issuance/ICSExport';
import { exportRISToExcel } from '@/components/features/ris/RISExport';

interface ViewDRPageProps {
    baseRoute: string;
    drId?: number;
    isModal?: boolean;
    onClose?: () => void;
    initialData?: DeliveryReceipt | null;
}


interface IssuanceIds {
    PAR?: number;
    ICS?: number;
}

export function ViewDRPage({ baseRoute, drId, isModal = false, onClose, initialData }: ViewDRPageProps) {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const [dr, setDr] = useState<DeliveryReceipt | null>(initialData ?? null);
    const [isLoading, setIsLoading] = useState(!initialData);
    const [issuanceIds, setIssuanceIds] = useState<IssuanceIds>({});
    const [exporting, setExporting] = useState<Record<string, boolean>>({});

    const resolvedId = drId ?? (params.id ? parseInt(params.id as string, 10) : null);

    const canEdit = user?.UserRoleID === 1 || user?.UserRoleID === 2;
    const inspectionStatus = dr?.inspection_status || dr?.InspectionStatus || 'pending';
    const isPartial = dr?.is_partial ?? dr?.IsPartial ?? false;
    const workflowStatus = dr?.workflow_status || (inspectionStatus === 'inspected' ? 'to_be_issued' : 'pending_inspection');
    const workflowLabel = dr?.workflow_status_label || (workflowStatus === 'to_be_issued' ? 'For Issuance' : workflowStatus === 'issued' ? 'Issued' : workflowStatus === 'acknowledged' ? 'Issued' : (workflowStatus === 'pending_inspection' ? 'Pending inspection' : ''));

    const risId = (dr as unknown as { ris_id?: number })?.ris_id ?? null;
    const risNumber = (dr as unknown as { ris_number?: string })?.ris_number ?? null;

    useEffect(() => {
        const fetchDR = async () => {
            try {
                if (!resolvedId) return;
                const data = await getDeliveryReceipt(resolvedId);
                setDr(data);
                setIsLoading(false);   // ← unblock immediately

                // Fire ensureIssuances in the background — don't block the UI
                issuanceAPI.ensureIssuances({ dr_id: resolvedId })
                    .then((ensured) => {
                        const byType = ensured.data?.issuances_by_document_type ?? {};
                        setIssuanceIds({
                            PAR: byType.PAR?.IssuanceID,
                            ICS: byType.ICS?.IssuanceID,
                        });
                    })
                    .catch(() => {
                        setIssuanceIds({});
                    });
            } catch {
                toast.error('Failed to load delivery receipt');
                if (isModal) {
                    onClose?.();
                } else {
                    router.push(`${baseRoute}/delivery-receipts`);
                }
                setIsLoading(false);
            }
        };

        if (resolvedId) {
            fetchDR();
        }
    }, [resolvedId, router, baseRoute, isModal, onClose]);

    if (isLoading) {
        return null;
    }

    if (!dr) {
        return (
            <div className={`flex items-center justify-center ${isModal ? 'py-10' : 'min-h-screen'}`} style={isModal ? undefined : { backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundAttachment: 'fixed' }}>
                <div className="text-center space-y-3">
                    <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
                    <p className="text-slate-600">Delivery receipt not found</p>
                    {isModal ? (
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-[var(--primary)] hover:underline"
                        >
                            Close
                        </button>
                    ) : (
                        <Link
                            href={`${baseRoute}/delivery-receipts`}
                            className="text-[var(--primary)] hover:underline"
                        >
                            Back to list
                        </Link>
                    )}
                </div>
            </div>
        );
    }

    const totalAmount = dr.details ? dr.details.reduce((sum, item) => {
        const cost = item.TotalCost ? parseFloat(String(item.TotalCost)) : 0;
        return sum + cost;
    }, 0) : 0;

    const resolveIssuanceId = async (type: 'PAR' | 'ICS'): Promise<number | undefined> => {
        let id = type === 'PAR' ? issuanceIds.PAR : issuanceIds.ICS;
        if (!id && resolvedId) {
            const ensured = await issuanceAPI.ensureIssuances({ dr_id: resolvedId });
            const byType = ensured.data?.issuances_by_document_type ?? {};
            id = byType[type]?.IssuanceID;
            setIssuanceIds({ PAR: byType.PAR?.IssuanceID, ICS: byType.ICS?.IssuanceID });
        }
        return id;
    };

    const handleExportIAR = async () => {
        if (!dr) return;
        setExporting((p) => ({ ...p, IAR: true }));
        try {
            await exportIARToExcel(dr);
        } catch {
            toast.error('Failed to export IAR');
        } finally {
            setExporting((p) => ({ ...p, IAR: false }));
        }
    };

    const handleExportPAR = async () => {
        setExporting((p) => ({ ...p, PAR: true }));
        try {
            const id = await resolveIssuanceId('PAR');
            if (!id) { toast.error('No PAR document available yet'); return; }
            const issuance = await issuanceAPI.getById(id);
            await exportPARToExcel(issuance);
        } catch {
            toast.error('Failed to export PAR');
        } finally {
            setExporting((p) => ({ ...p, PAR: false }));
        }
    };

    const handleExportICS = async () => {
        setExporting((p) => ({ ...p, ICS: true }));
        try {
            const id = await resolveIssuanceId('ICS');
            if (!id) { toast.error('No ICS document available yet'); return; }
            const issuance = await issuanceAPI.getById(id);
            await exportICSToExcel(issuance);
        } catch {
            toast.error('Failed to export ICS');
        } finally {
            setExporting((p) => ({ ...p, ICS: false }));
        }
    };

    const handleExportRIS = async () => {
        if (!risId) { toast.error('No RIS available for this DR yet'); return; }
        setExporting((p) => ({ ...p, RIS: true }));
        try {
            const ris = await getRis(risId);
            await exportRISToExcel(ris);
        } catch {
            toast.error('Failed to export RIS');
        } finally {
            setExporting((p) => ({ ...p, RIS: false }));
        }
    };

    return (
        <div className={isModal ? 'print:hidden' : 'min-h-screen bg-fixed bg-cover bg-center bg-no-repeat print:hidden'} style={isModal ? undefined : { backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}>
            <div className="p-6 w-full space-y-6">
                <div className="flex items-center gap-4">
                    {isModal ? (
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                            type="button"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    ) : (
                        <button
                            onClick={() => router.back()}
                            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                            type="button"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Delivery Receipt Details</h1>
                        <p className="text-slate-500 text-sm">DR Number: {dr.DRNumber}</p>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        type="button"
                        onClick={() => void handleExportIAR()}
                        disabled={exporting.IAR}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors font-medium"
                        title="Export Inspection and Acceptance Report"
                    >
                        <Download className="w-4 h-4" />
                        {exporting.IAR ? 'Exporting…' : 'Export IAR'}
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleExportPAR()}
                        disabled={exporting.PAR}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-60 transition-colors font-medium"
                        title="Export Property Acknowledgment Receipt"
                    >
                        <Download className="w-4 h-4" />
                        {exporting.PAR ? 'Exporting…' : 'Export PAR'}
                    </button>
                    {issuanceIds.ICS && (
                        <button
                            type="button"
                            onClick={() => void handleExportICS()}
                            disabled={exporting.ICS}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition-colors font-medium"
                            title="Export Inventory Custodian Slip"
                        >
                            <Download className="w-4 h-4" />
                            {exporting.ICS ? 'Exporting…' : 'Export ICS'}
                        </button>
                    )}
                    {risId && (
                        <button
                            type="button"
                            onClick={() => void handleExportRIS()}
                            disabled={exporting.RIS}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors font-medium"
                            title={`Export Requisition and Issue Slip${risNumber ? ` (${risNumber})` : ''}`}
                        >
                            <Download className="w-4 h-4" />
                            {exporting.RIS ? 'Exporting…' : 'Export RIS'}
                        </button>
                    )}
                    {canEdit && workflowStatus !== 'acknowledged' && workflowStatus !== 'partially_acknowledged' && (
                        <Link
                            href={`${baseRoute}/delivery-receipts/${dr.DRID}/edit`}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 transition-colors font-medium"
                        >
                            <Edit className="w-4 h-4" />
                            Edit DR
                        </Link>
                    )}
                    {canEdit && isPartial && (
                        <Link
                            href={`${baseRoute}/delivery-receipts/${dr.DRID}/add-items`}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                        >
                            <Plus className="w-4 h-4" />
                            Add Items / Finalize
                        </Link>
                    )}
                </div>

                {isPartial && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                        This delivery receipt is partial. Use Add Items / Finalize to add remaining items or finalize the DR.
                    </div>
                )}

                {/* DR Header */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Delivery Receipt Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">DR Number</label>
                            <div className="mt-1 flex items-center gap-2">
                                <p className="text-slate-900">{dr.DRNumber}</p>
                                {/temp/i.test(dr.DRNumber) && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                                        TEMPORARY
                                    </span>
                                )}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">IAR Number</label>
                            <p className="mt-1 text-slate-900">
                                {dr.IARNumber ? (
                                    <span className="font-mono">{dr.IARNumber}</span>
                                ) : (
                                    <span className="text-slate-500 italic">Pending generation</span>
                                )}
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Supplier Name</label>
                            <p className="mt-1 text-slate-900">{dr.SupplierName || 'N/A'}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Requested By</label>
                            <p className="mt-1 text-slate-900">{dr.requestedByUser?.FullName || dr.RequestedByName || 'N/A'}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Department</label>
                            <p className="mt-1 text-slate-900">{dr.requestedByUser?.department?.DepartmentName || dr.DepartmentName || 'N/A'}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">PR Number</label>
                            <p className="mt-1 text-slate-900">{dr.PRNumber || 'N/A'}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">PO Number</label>
                            <p className="mt-1 text-slate-900">{dr.PONumber || 'N/A'}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Invoice Number</label>
                            <p className="mt-1 text-slate-900">{dr.InvoiceNumber || 'N/A'}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Date Received</label>
                            <p className="mt-1 text-slate-900">{
                                (() => {
                                    const zonedDate = toZonedTime(new Date(dr.DateReceived), 'Asia/Manila');
                                    return format(zonedDate, 'PPP');
                                })()
                            }</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Received By</label>
                            <p className="mt-1 text-slate-900">{dr.receivedByUser?.FullName || 'Unknown'}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Inspected By</label>
                            <p className="mt-1 text-slate-900">{dr.receivedByUser?.FullName || 'Unknown'}</p>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700">Remarks</label>
                            <p className="mt-1 text-slate-900">{dr.Remarks || 'No remarks'}</p>
                        </div>
                        {dr.dr_picture_url && (
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-2">DR Picture</label>
                                <img
                                    src={dr.dr_picture_url}
                                    alt="DR Picture"
                                    className="max-w-full h-auto rounded-lg border border-slate-200"
                                    style={{ maxHeight: '400px' }}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Items Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Delivered Items</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200">
                                    <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">#</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">Article</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">Item Description</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-slate-700 min-w-[160px]">Property Type</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-slate-700 min-w-[220px]">Details</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-slate-700 w-24">Qty</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">Unit Cost</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">Total Cost</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-slate-700 min-w-[180px]">End User</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {dr.details?.map((item, index) => {
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    const assignments: {
                                        inventory_detail_id: number;
                                        receiver_name: string;
                                        position_office: string | null;
                                        office_name?: string | null;
                                    }[] = (item as any).end_user_assignments ?? [];
                                    const uniqueReceivers = assignments.reduce<{
                                        receiver_name: string;
                                        position_office: string | null;
                                        office_name: string | null;
                                        count: number;
                                    }[]>((acc, a) => {
                                        const existing = acc.find(r =>
                                            r.receiver_name === a.receiver_name
                                            && r.position_office === a.position_office
                                            && r.office_name === (a.office_name ?? null)
                                        );
                                        if (existing) { existing.count++; }
                                        else {
                                            acc.push({
                                                receiver_name: a.receiver_name,
                                                position_office: a.position_office,
                                                office_name: a.office_name ?? null,
                                                count: 1,
                                            });
                                        }
                                        return acc;
                                    }, []);

                                    return (
                                        <tr key={item.DRDetailID}>
                                            <td className="py-3 px-3 text-sm text-slate-600">{index + 1}</td>
                                            <td className="py-3 px-3 text-sm text-slate-900">{item.article?.ArticleName || '—'}</td>
                                            <td className="py-3 px-3 text-sm text-slate-900">{item.ItemDescription}</td>
                                            <td className="py-3 px-3 min-w-[160px] text-sm text-slate-600">{item.propertyType?.PropertyName || ''}</td>
                                            <td className="py-3 px-3 min-w-[220px] text-sm text-slate-600">
                                                <div className="text-sm text-slate-700">
                                                    {item.Brand && <span className="mr-2">{`Brand: ${item.Brand}`}</span>}
                                                    {item.ModelNumber && <span className="mr-2">{`Model: ${item.ModelNumber}`}</span>}
                                                    {item.SerialNumber && <span className="mr-2">{`Serial: ${item.SerialNumber}`}</span>}
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 w-28 text-center">
                                                <div className="text-sm">{item.QuantityDelivered}</div>
                                                <div className="text-xs text-slate-500 mt-1">{item.unitOfMeasure?.UnitName || 'N/A'}</div>
                                            </td>
                                            <td className="py-3 px-3 text-sm text-slate-600">₱{parseFloat(String(item.UnitCost)).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            <td className="py-3 px-3 text-sm text-slate-600">₱{parseFloat(String(item.TotalCost)).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            <td className="py-3 px-3 min-w-[180px] text-sm">
                                                {uniqueReceivers.length === 0 ? (
                                                    <span className="text-slate-400 italic text-xs">Not assigned</span>
                                                ) : (
                                                    <div className="space-y-1">
                                                        {uniqueReceivers.map((r, ri) => (
                                                            <div key={ri} className="flex flex-col">
                                                                <span className="font-medium text-slate-800 text-xs">
                                                                    {r.receiver_name}
                                                                    {uniqueReceivers.length > 1 || (assignments.length > 1 && r.count > 1)
                                                                        ? <span className="ml-1 text-slate-400 font-normal">×{r.count}</span>
                                                                        : null}
                                                                </span>
                                                                {(r.position_office || r.office_name) && (
                                                                    <span className="text-xs text-slate-500 whitespace-pre-line">
                                                                        {formatAssignmentPositionDisplay(r.position_office, r.office_name)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Summary */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Summary</h2>
                    <div className="flex items-center justify-between text-lg">
                        <span className="text-slate-600">Total Amount:</span>
                        <span className="font-bold text-slate-900">₱{totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                        <span className="text-slate-600">Status:</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${isPartial ? 'bg-amber-100 text-amber-800' : workflowStatus === 'pending_inspection' ? 'bg-amber-100 text-amber-700' : workflowStatus === 'to_be_issued' ? 'bg-indigo-100 text-indigo-700' : workflowStatus === 'issued' ? 'bg-emerald-100 text-emerald-700' : workflowStatus === 'acknowledged' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                            {workflowLabel}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Loader2, Download } from 'lucide-react';
import { getDeliveryReceipts } from '@/lib/api/deliveryReceipts';
import { getIARs } from '@/lib/api/iar';
import issuanceAPI from '@/lib/api/issuance';
import { DeliveryReceipt } from '@/types/procurement';
import { IAR } from '@/types/iar';
import { AssetIssuance, AssetIssuanceFilters } from '@/types/assetIssuance';
import { csvEscape, daysAgoManilaYmd, downloadTextFile, todayManilaYmd, safeManilaYmdFromIso, getErrorMessage } from './reportUtils';

async function fetchAllDeliveryReceipts(startDate: string, endDate: string): Promise<DeliveryReceipt[]> {
    const perPage = 50;
    const first = await getDeliveryReceipts({ start_date: startDate, end_date: endDate, per_page: perPage, page: 1 });
    const all: DeliveryReceipt[] = [...first.data];

    const lastPage = first.meta?.last_page ?? 1;
    for (let page = 2; page <= lastPage; page++) {
        const res = await getDeliveryReceipts({ start_date: startDate, end_date: endDate, per_page: perPage, page });
        all.push(...res.data);
    }

    return all;
}

async function fetchAllIARs(startDate: string, endDate: string): Promise<IAR[]> {
    const perPage = 50;
    const first = await getIARs({ start_date: startDate, end_date: endDate, per_page: perPage, page: 1 });
    const all: IAR[] = [...first.data];

    const lastPage = first.meta?.last_page ?? 1;
    for (let page = 2; page <= lastPage; page++) {
        const res = await getIARs({ start_date: startDate, end_date: endDate, per_page: perPage, page });
        all.push(...res.data);
    }

    return all;
}

type GroupedIssuance = {
    RequestID: number;
    RequestNumber: string;
    RequestDate: string;
    requester: {
        FullName: string;
        Department: string;
    };
    department: {
        DepartmentName: string;
    };
    issuances: AssetIssuance[];
    totalItems: number;
};

async function fetchAllIssuanceGroups(filters: AssetIssuanceFilters): Promise<GroupedIssuance[]> {
    const perPage = 50;
    const first = await issuanceAPI.getAll({ ...filters, per_page: perPage, page: 1 });
    const all: GroupedIssuance[] = [...first.data];

    const lastPage = first.last_page ?? 1;
    for (let page = 2; page <= lastPage; page++) {
        const res = await issuanceAPI.getAll({ ...filters, per_page: perPage, page });
        all.push(...res.data);
    }

    return all;
}

function isDateInRange(dateYmd: string, startYmd: string, endYmd: string): boolean {
    return dateYmd >= startYmd && dateYmd <= endYmd;
}

type ExportKind = 'dr' | 'iar' | 'issuance' | null;

export default function AdminReportsCustomPage() {
    const [startDate, setStartDate] = useState<string>(() => daysAgoManilaYmd(30));
    const [endDate, setEndDate] = useState<string>(() => todayManilaYmd());
    const [exporting, setExporting] = useState<ExportKind>(null);

    const [issuanceDocType, setIssuanceDocType] = useState<AssetIssuanceFilters['document_type'] | ''>('');
    const [issuanceStatus, setIssuanceStatus] = useState<AssetIssuanceFilters['status'] | ''>('');

    const isValidRange = useMemo(() => {
        if (!startDate || !endDate) return false;
        return startDate <= endDate;
    }, [startDate, endDate]);

    const exportDRCsv = async () => {
        if (!isValidRange) {
            toast.error('Invalid date range');
            return;
        }

        try {
            setExporting('dr');
            const rows = await fetchAllDeliveryReceipts(startDate, endDate);

            const header = [
                'DRID',
                'DRNumber',
                'SupplierName',
                'PONumber',
                'InvoiceNumber',
                'DateReceived(Asia/Manila)',
                'ReceivedBy',
                'Remarks',
                'Status'
            ];

            const lines = [header.join(',')];

            for (const dr of rows) {
                // Avoid throwing on invalid/missing dates
                const dateReceived = safeManilaYmdFromIso(dr.DateReceived) || '';

                const line = [
                    String(dr.DRID),
                    csvEscape(dr.DRNumber),
                    csvEscape(dr.SupplierName || ''),
                    csvEscape(dr.PONumber || ''),
                    csvEscape(dr.InvoiceNumber || ''),
                    csvEscape(dateReceived),
                    csvEscape(dr.receivedByUser?.FullName || String(dr.ReceivedBy)),
                    csvEscape(dr.Remarks || ''),
                    csvEscape(dr.workflow_status_label || ((dr.inspection_status || dr.InspectionStatus) === 'inspected' ? 'To be accepted' : 'Pending inspection')),
                ].join(',');

                lines.push(line);
            }

            const filename = `delivery_receipts_${startDate}_to_${endDate}.csv`;
            downloadTextFile(filename, lines.join('\n'), 'text/csv;charset=utf-8');
            toast.success(`Exported ${rows.length} delivery receipts`);
        } catch (e) {
            toast.error(getErrorMessage(e) || 'Failed to export delivery receipts');
        } finally {
            setExporting(null);
        }
    };

    const exportIARSummaryCsv = async () => {
        if (!isValidRange) {
            toast.error('Invalid date range');
            return;
        }

        try {
            setExporting('iar');
            const rows = await fetchAllIARs(startDate, endDate);

            const header = [
                'IARID',
                'IARNumber',
                'DRNumber',
                'SupplierName',
                'PONumber',
                'InvoiceNumber',
                'DateInspected(Asia/Manila)',
                'DateAccepted(Asia/Manila)',
                'InspectedBy',
                'AcceptedBy',
                'AcceptedQtyTotal',
                'RejectedQtyTotal',
                'AcceptedAmountTotal'
            ];

            const lines = [header.join(',')];

            for (const iar of rows) {
                const acceptedQty = (iar.details ?? []).reduce((sum, d) => sum + (d.QuantityAccepted || 0), 0);
                const rejectedQty = (iar.details ?? []).reduce((sum, d) => sum + (d.QuantityRejected || 0), 0);
                const acceptedAmount = (iar.details ?? []).reduce((sum, d) => {
                    const unitCost = d.drDetail?.UnitCost ?? 0;
                    return sum + (d.QuantityAccepted || 0) * unitCost;
                }, 0);

                const line = [
                    String(iar.IARID),
                    csvEscape(iar.IARNumber),
                    csvEscape(iar.deliveryReceipt?.DRNumber || ''),
                    csvEscape(iar.deliveryReceipt?.SupplierName || ''),
                    csvEscape(iar.deliveryReceipt?.PONumber || ''),
                    csvEscape(iar.deliveryReceipt?.InvoiceNumber || ''),
                    csvEscape(safeManilaYmdFromIso(iar.DateInspected)),
                    csvEscape(safeManilaYmdFromIso(iar.DateAccepted || null)),
                    csvEscape(iar.inspectedByUser?.FullName || String(iar.InspectedBy)),
                    csvEscape(iar.acceptedByUser?.FullName || (iar.AcceptedBy ? String(iar.AcceptedBy) : '')),
                    csvEscape(String(acceptedQty)),
                    csvEscape(String(rejectedQty)),
                    csvEscape(String(Math.round(acceptedAmount * 100) / 100)),
                ].join(',');

                lines.push(line);
            }

            const filename = `iar_summary_${startDate}_to_${endDate}.csv`;
            downloadTextFile(filename, lines.join('\n'), 'text/csv;charset=utf-8');
            toast.success(`Exported ${rows.length} IARs`);
        } catch (e) {
            toast.error(getErrorMessage(e) || 'Failed to export IAR summary');
        } finally {
            setExporting(null);
        }
    };

    const exportIssuanceLogCsv = async () => {
        if (!isValidRange) {
            toast.error('Invalid date range');
            return;
        }

        try {
            setExporting('issuance');
            const groups = await fetchAllIssuanceGroups({
                document_type: issuanceDocType || undefined,
                status: issuanceStatus || undefined,
            });

            const header = [
                'RequestNumber',
                'RequestDate(Asia/Manila)',
                'Department',
                'Requester(ReceivedBy)',
                'IssuanceID',
                'DocumentType',
                'DocumentNumber',
                'IssuanceDate(Asia/Manila)',
                'Status',
                'AcknowledgedAt(Asia/Manila)',
                'IssuedBy',
                'IssuedTo'
            ];

            const lines = [header.join(',')];

            let rowCount = 0;
            for (const group of groups) {
                const requestDateYmd = safeManilaYmdFromIso(group.RequestDate);

                for (const issuance of group.issuances) {
                    const issuanceDateYmd = safeManilaYmdFromIso(issuance.IssuanceDate);
                    if (!issuanceDateYmd || !isDateInRange(issuanceDateYmd, startDate, endDate)) continue;

                    const acknowledgedAtYmd = safeManilaYmdFromIso(issuance.AcknowledgedAt);

                    const line = [
                        csvEscape(group.RequestNumber),
                        csvEscape(requestDateYmd),
                        csvEscape(group.department?.DepartmentName || group.requester?.Department || ''),
                        csvEscape(group.requester?.FullName || ''),
                        String(issuance.IssuanceID),
                        csvEscape(issuance.DocumentType),
                        csvEscape(issuance.DocumentNumber),
                        csvEscape(issuanceDateYmd),
                        csvEscape(issuance.Status),
                        csvEscape(acknowledgedAtYmd),
                        csvEscape(issuance.issuer?.FullName || String(issuance.IssuedBy)),
                        csvEscape(issuance.issuedToUser?.FullName || issuance.IssuedToName || ''),
                    ].join(',');

                    lines.push(line);
                    rowCount++;
                }
            }

            const filename = `issuance_log_${startDate}_to_${endDate}.csv`;
            downloadTextFile(filename, lines.join('\n'), 'text/csv;charset=utf-8');
            toast.success(`Exported ${rowCount} issuance rows`);
        } catch (e) {
            toast.error(getErrorMessage(e) || 'Failed to export issuance log');
        } finally {
            setExporting(null);
        }
    };

    return (
        <div className="min-h-screen bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')" }}>
            <div className="p-6 max-w-6xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Custom Reports</h1>
                        <p className="text-slate-600 text-sm">Exports and summaries (PH time)</p>
                    </div>
                    <Link href="/admin/reports/standard" className="text-sm text-[var(--primary)] underline">
                        Back to Standard Reports
                    </Link>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-slate-900">Date Range</h2>
                    <p className="text-sm text-slate-600 mt-1">All exports use this PH date range.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Start date</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2"
                                max={endDate}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">End date</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2"
                                min={startDate}
                                max={todayManilaYmd()}
                            />
                        </div>
                    </div>

                    {!isValidRange ? (
                        <div className="mt-3 text-sm text-red-600">Invalid range: start date must be on/before end date.</div>
                    ) : null}
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-slate-900">Export: Delivery Receipts (CSV)</h2>
                    <p className="text-sm text-slate-600 mt-1">Exports DR headers (not line-item details) for the selected date range.</p>

                    <div className="mt-5">
                        <button
                            onClick={exportDRCsv}
                            disabled={!isValidRange || exporting !== null}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white disabled:opacity-60"
                        >
                            {exporting === 'dr' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            {exporting === 'dr' ? 'Exporting…' : 'Download DR CSV'}
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-slate-900">Export: IAR Summary (CSV)</h2>
                    <p className="text-sm text-slate-600 mt-1">Exports IAR headers with totals (accepted/rejected/amount) for the selected date range.</p>

                    <div className="mt-5">
                        <button
                            onClick={exportIARSummaryCsv}
                            disabled={!isValidRange || exporting !== null}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white disabled:opacity-60"
                        >
                            {exporting === 'iar' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            {exporting === 'iar' ? 'Exporting…' : 'Download IAR Summary CSV'}
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-slate-900">Export: PAR/ICS Issuance Log (CSV)</h2>
                    <p className="text-sm text-slate-600 mt-1">Exports issuance rows (filtered client-side by Issuance Date).</p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Document type</label>
                            <select
                                value={issuanceDocType}
                                onChange={(e) => setIssuanceDocType((e.target.value || '') as typeof issuanceDocType)}
                                className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2"
                            >
                                <option value="">All</option>
                                <option value="PAR">PAR</option>
                                <option value="ICS">ICS</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Status</label>
                            <select
                                value={issuanceStatus}
                                onChange={(e) => setIssuanceStatus((e.target.value || '') as typeof issuanceStatus)}
                                className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2"
                            >
                                <option value="">All</option>
                                <option value="pending_acknowledgment">Pending Acknowledgment</option>
                                <option value="acknowledged">Acknowledged</option>
                                <option value="returned">Returned</option>
                                <option value="disposed">Disposed</option>
                            </select>
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={exportIssuanceLogCsv}
                                disabled={!isValidRange || exporting !== null}
                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white disabled:opacity-60"
                            >
                                {exporting === 'issuance' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                {exporting === 'issuance' ? 'Exporting…' : 'Download Issuance Log CSV'}
                            </button>
                        </div>
                    </div>

                    <div className="mt-4 text-xs text-slate-500">
                        Note: issuance date filtering is applied client-side because the issuance list API currently exposes status/type filters only.
                    </div>
                </div>
            </div>
        </div>
    );
}

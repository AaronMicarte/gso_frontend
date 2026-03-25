'use client';

import { useMemo, useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { CheckCircle, ClipboardList, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/hooks/useAuth';
import {
    usePendingInspectionReceipts,
    useCreateInspectionReport,
    useUpdateInspectionReport,
    useCompleteInspectionReport,
    useInspectionConditions,
} from '@/lib/hooks/useInspection';
import { InspectionPendingReceipt } from '@/types/inspection';

type ItemRowState = {
    remarks: string;
    conditionId: number | '';
    quantity: number;
};

type ItemMetaState = {
    brand: string;
    modelNumber: string;
    serialNumber: string;
    noSerial: boolean;
    changeReason: string;
};

type OriginalDetail = {
    brand: string;
    modelNumber: string;
    serialNumber: string;
};

export function InspectionQueuePage() {
    const { user } = useAuth();
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<InspectionPendingReceipt | null>(null);
    const [reportId, setReportId] = useState<number | null>(null);
    const [remarks, setRemarks] = useState('');
    const [itemRows, setItemRows] = useState<Record<number, ItemRowState[]>>({});
    const [itemMeta, setItemMeta] = useState<Record<number, ItemMetaState>>({});
    const [originalDetails, setOriginalDetails] = useState<Record<number, OriginalDetail>>({});

    const { data } = usePendingInspectionReceipts({ per_page: 50 });
    const createReport = useCreateInspectionReport();
    const updateReport = useUpdateInspectionReport();
    const completeReport = useCompleteInspectionReport();
    const { data: conditions } = useInspectionConditions();
    const isSaving = createReport.isPending || updateReport.isPending;
    const isCompleting = completeReport.isPending;

    const inspectorName = useMemo(() => user?.FullName ?? '', [user?.FullName]);

    const hydrateSelection = (receipt: InspectionPendingReceipt | null) => {
        setSelected(receipt);

        if (!receipt) {
            setReportId(null);
            setRemarks('');
            setItemRows({});
            setItemMeta({});
            setOriginalDetails({});
            return;
        }

        const draft = receipt.iar || null;
        setReportId(draft?.IARID || null);
        setRemarks(draft?.Remarks || '');

        const initialRows: Record<number, ItemRowState[]> = {};
        const initialMeta: Record<number, ItemMetaState> = {};
        const originals: Record<number, OriginalDetail> = {};
        receipt.details?.forEach((detail) => {
            const brand = detail.Brand || '';
            const modelNumber = detail.ModelNumber || '';
            const serialNumber = detail.SerialNumber || '';
            const existingRows = draft?.details?.filter((item) => item.DRDetailID === detail.DRDetailID) || [];
            const buildRow = (row?: typeof existingRows[number]): ItemRowState => ({
                remarks: row?.Remarks || '',
                conditionId: row?.ConditionID ?? '',
                quantity: (row?.QuantityAccepted ?? 0) + (row?.QuantityRejected ?? 0) || detail.QuantityDelivered,
            });

            initialRows[detail.DRDetailID] = existingRows.length > 0
                ? existingRows.map((row) => buildRow(row))
                : [buildRow()];

            const firstRow = existingRows[0];
            initialMeta[detail.DRDetailID] = {
                brand: firstRow?.VerifiedBrand || brand,
                modelNumber: firstRow?.VerifiedModel || modelNumber,
                serialNumber: firstRow?.VerifiedSerial || serialNumber,
                noSerial: firstRow?.NoSerial ?? false,
                changeReason: firstRow?.change_reason || '',
            };
            originals[detail.DRDetailID] = {
                brand,
                modelNumber,
                serialNumber,
            };
        });

        setItemRows(initialRows);
        setItemMeta(initialMeta);
        setOriginalDetails(originals);
    };

    const todayManila = useMemo(
        () => formatInTimeZone(new Date(), 'Asia/Manila', 'yyyy-MM-dd'),
        []
    );

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return data?.data || [];
        return (data?.data || []).filter((dr) => {
            return (
                dr.DRNumber.toLowerCase().includes(term) ||
                dr.SupplierName.toLowerCase().includes(term) ||
                (dr.PONumber || '').toLowerCase().includes(term)
            );
        });
    }, [data?.data, search]);

    const normalizeValue = (value: string) => value.trim();

    const getRows = (detailId: number) => itemRows[detailId] || [];
    const getMeta = (detailId: number) => itemMeta[detailId];

    const updateRow = (detailId: number, rowIndex: number, patch: Partial<ItemRowState>) => {
        setItemRows((prev) => {
            const rows = [...(prev[detailId] || [])];
            if (!rows[rowIndex]) return prev;
            rows[rowIndex] = { ...rows[rowIndex], ...patch };
            return { ...prev, [detailId]: rows };
        });
    };

    const updateMeta = (detailId: number, patch: Partial<ItemMetaState>) => {
        setItemMeta((prev) => {
            const current = prev[detailId];
            if (!current) return prev;
            return { ...prev, [detailId]: { ...current, ...patch } };
        });
    };

    const addRow = (detailId: number, quantity: number) => {
        setItemRows((prev) => {
            const rows = [...(prev[detailId] || [])];
            rows.push({
                remarks: '',
                conditionId: '',
                quantity: Math.max(0, quantity),
            });
            return { ...prev, [detailId]: rows };
        });
    };

    const removeRow = (detailId: number, rowIndex: number) => {
        setItemRows((prev) => {
            const rows = [...(prev[detailId] || [])];
            if (rows.length <= 1) return prev;
            rows.splice(rowIndex, 1);
            return { ...prev, [detailId]: rows };
        });
    };

    const conditionMap = useMemo(() => {
        const entries = conditions?.map((condition) => [condition.ConditionID, condition.ConditionName] as const) || [];
        return new Map<number, string>(entries);
    }, [conditions]);

    const getConditionMode = (conditionId: number | '') => {
        if (!conditionId) return 'reject';
        const name = (conditionMap.get(conditionId) || '').toLowerCase();
        if (name.includes('unserviceable') || name.includes('unservicable')) return 'reject';
        if (name.includes('serviceable')) return 'accept';
        return 'reject';
    };

    function hasDetailChanges(detailId: number, meta?: ItemMetaState) {
        const original = originalDetails[detailId];
        if (!original || !meta) return false;
        return (
            normalizeValue(meta.brand) !== normalizeValue(original.brand) ||
            normalizeValue(meta.modelNumber) !== normalizeValue(original.modelNumber) ||
            normalizeValue(meta.serialNumber) !== normalizeValue(original.serialNumber)
        );
    }

    const getRowQuantity = (row: ItemRowState) => Math.max(0, Number(row.quantity || 0));

    const totalItems = selected?.details?.length || 0;
    const isItemComplete = (detailId: number, delivered: number) => {
        const rows = getRows(detailId);
        const meta = getMeta(detailId);
        if (rows.length === 0) return false;
        if (!meta) return false;

        let total = 0;
        for (const row of rows) {
            if (!normalizeValue(meta.brand) || !normalizeValue(meta.modelNumber)) return false;
            if (!meta.noSerial && !normalizeValue(meta.serialNumber)) return false;
            if (!row.conditionId) return false;

            const qty = getRowQuantity(row);
            if (qty <= 0) return false;
            const mode = getConditionMode(row.conditionId);
            if (row.conditionId && mode === 'reject' && !normalizeValue(row.remarks)) return false;
            if (hasDetailChanges(detailId, meta) && !normalizeValue(meta.changeReason)) return false;
            total += qty;
        }
        if (total !== delivered) return false;
        return true;
    };
    const inspectedCount = selected?.details?.filter((detail) => isItemComplete(detail.DRDetailID, detail.QuantityDelivered)).length || 0;
    const canComplete = totalItems > 0 && inspectedCount === totalItems && reportId !== null;

    const validateItemDetails = () => {
        if (!selected?.details) return true;
        for (const detail of selected.details) {
            const rows = getRows(detail.DRDetailID);
            const meta = getMeta(detail.DRDetailID);
            if (rows.length === 0) {
                toast.error(`Add at least one inspection row for ${detail.ItemDescription}.`);
                return false;
            }
            if (!meta) {
                toast.error(`Missing item details for ${detail.ItemDescription}.`);
                return false;
            }

            let total = 0;
            for (const [index, row] of rows.entries()) {
                const rowLabel = `Row ${index + 1}`;
                if (!normalizeValue(meta.brand) || !normalizeValue(meta.modelNumber)) {
                    toast.error(`${rowLabel}: Brand and model are required for ${detail.ItemDescription}.`);
                    return false;
                }
                if (!meta.noSerial && !normalizeValue(meta.serialNumber)) {
                    toast.error(`${rowLabel}: Serial number is required or mark no serial for ${detail.ItemDescription}.`);
                    return false;
                }
                if (!row.conditionId) {
                    toast.error(`${rowLabel}: Condition is required for ${detail.ItemDescription}.`);
                    return false;
                }
                const qty = getRowQuantity(row);
                if (qty <= 0) {
                    toast.error(`${rowLabel}: Quantity must be greater than 0.`);
                    return false;
                }
                const mode = getConditionMode(row.conditionId);
                if (row.conditionId && mode === 'reject' && !normalizeValue(row.remarks)) {
                    toast.error(`${rowLabel}: Reject reason is required when rejecting quantity.`);
                    return false;
                }
                if (hasDetailChanges(detail.DRDetailID, meta) && !normalizeValue(meta.changeReason)) {
                    toast.error(`Provide a reason for brand/model/serial changes in ${detail.ItemDescription}.`);
                    return false;
                }
                total += qty;
            }

            if (total !== detail.QuantityDelivered) {
                toast.error(`Accepted + rejected must equal delivered quantity for ${detail.ItemDescription}.`);
                return false;
            }
        }
        return true;
    };

    const validateInspectorName = () => {
        const typed = inspectorName.trim().toLowerCase().replace(/\s+/g, ' ');
        const expected = (user?.FullName || '').trim().toLowerCase().replace(/\s+/g, ' ');
        if (!typed || typed !== expected) {
            toast.error('Inspector name must match your account name.');
            return false;
        }
        return true;
    };

    const handleSave = async () => {
        if (!selected) return;
        if (!validateInspectorName()) return;
        if (!validateItemDetails()) return;

        const payloadItems = selected.details?.flatMap((detail) => {
            const rows = getRows(detail.DRDetailID);
            const meta = getMeta(detail.DRDetailID);
            if (!meta) return [];
            return rows.map((row) => ({
                dr_detail_id: detail.DRDetailID,
                condition_id: typeof row.conditionId === 'number' ? row.conditionId : 0,
                quantity_accepted: getConditionMode(row.conditionId) === 'accept' ? getRowQuantity(row) : 0,
                quantity_rejected: getConditionMode(row.conditionId) === 'reject' ? getRowQuantity(row) : 0,
                verified_brand: meta.brand ? normalizeValue(meta.brand) : null,
                verified_model: meta.modelNumber ? normalizeValue(meta.modelNumber) : null,
                verified_serial: meta.serialNumber ? normalizeValue(meta.serialNumber) : null,
                no_serial: meta.noSerial || false,
                remarks: row.remarks || '',
                change_reason: meta.changeReason ? normalizeValue(meta.changeReason) : undefined,
            }));
        }) || [];

        try {
            if (reportId) {
                const updated = await updateReport.mutateAsync({
                    id: reportId,
                    payload: {
                        remarks,
                        items: payloadItems,
                    },
                });
                toast.success('Inspection report updated');
                setSelected((prev) => (prev ? { ...prev, iar: updated } : prev));
            } else {
                const created = await createReport.mutateAsync({
                    dr_id: selected.DRID,
                    inspector_name: inspectorName,
                    date_inspected: todayManila,
                    remarks,
                    items: payloadItems,
                });
                setReportId(created.IARID);
                setSelected((prev) => (prev ? { ...prev, iar: created } : prev));
                toast.success('Inspection report saved');
            }
        } catch (error: unknown) {
            let message = 'Failed to save inspection report';
            if (typeof error === 'object' && error !== null && 'message' in error) {
                const msg = (error as { message?: unknown }).message;
                if (typeof msg === 'string') message = msg;
            }
            toast.error(message);
        }
    };

    const handleComplete = async () => {
        if (!reportId) return;
        if (!canComplete) {
            toast.error('All items must be marked as inspected before completion.');
            return;
        }
        if (!validateItemDetails()) return;
        try {
            await completeReport.mutateAsync(reportId);
            toast.success('Inspection completed. Items are pending acceptance.');
            hydrateSelection(null);
        } catch (error: unknown) {
            let message = 'Failed to complete inspection';
            if (typeof error === 'object' && error !== null && 'message' in error) {
                const msg = (error as { message?: unknown }).message;
                if (typeof msg === 'string') message = msg;
            }
            toast.error(message);
        }
    };

    return (
        <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}>
            <div className="p-6 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-semibold text-slate-900">Inspection Queue</h1>
                        <p className="text-sm text-slate-600">Review pending delivery receipts and capture inspection details.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                        <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
                            <CheckCircle className="w-4 h-4 text-[var(--primary)]" />
                            <span>{inspectedCount}/{totalItems} items inspected</span>
                        </div>
                        {selected && (
                            <span className="text-xs text-slate-500">
                                Status: {reportId ? (canComplete ? 'Ready to complete' : 'Draft saved') : 'Not saved'}
                            </span>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-6">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search DR, supplier, or PO"
                                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            />
                        </div>

                        {filtered.length === 0 ? (
                            <div className="py-12 text-center text-slate-500 text-sm">
                                <ClipboardList className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                No pending inspections
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[540px] overflow-auto pr-1">
                                {filtered.map((dr) => (
                                    <button
                                        key={dr.DRID}
                                        type="button"
                                        onClick={() => hydrateSelection(dr)}
                                        className={`w-full text-left p-3 rounded-lg border transition-colors ${selected?.DRID === dr.DRID ? 'border-[var(--primary)] bg-[var(--primary)]/10' : 'border-slate-200 hover:border-slate-300'}`}
                                    >
                                        <div className="text-sm font-semibold text-slate-900">{dr.DRNumber}</div>
                                        <div className="text-xs text-slate-500">{dr.SupplierName}</div>
                                        <div className="text-xs text-slate-400 mt-1">PO: {dr.PONumber || 'N/A'}</div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 min-h-[540px]">
                        {!selected ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm">
                                <ClipboardList className="w-10 h-10 text-slate-300 mb-3" />
                                Select a delivery receipt to inspect.
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                    <div>
                                        <h2 className="text-xl font-semibold text-slate-900">{selected.DRNumber}</h2>
                                        <p className="text-sm text-slate-500">{selected.SupplierName}</p>
                                    </div>
                                    <div className="text-sm text-slate-500">
                                        Items inspected: <span className="font-semibold text-slate-900">{inspectedCount}/{totalItems}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-700">
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-slate-400">Requested By</p>
                                        <p className="font-medium">{selected.RequestedByName || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-slate-400">Department</p>
                                        <p className="font-medium">{selected.DepartmentName || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-slate-400">PO Number</p>
                                        <p className="font-medium">{selected.PONumber || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-slate-400">Inspection Date</p>
                                        <p className="font-medium">{todayManila}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs uppercase tracking-wide text-slate-400 mb-2">Inspector Name</label>
                                        <input
                                            value={inspectorName}
                                            readOnly
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-700 cursor-not-allowed"
                                            placeholder="Inspector name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs uppercase tracking-wide text-slate-400 mb-2">General Remarks</label>
                                        <input
                                            value={remarks}
                                            onChange={(event) => setRemarks(event.target.value)}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                            placeholder="Inspection notes"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold text-slate-700">Inspection Items</h3>
                                    <div className="space-y-3">
                                        {selected.details?.map((detail) => {
                                            const rows = getRows(detail.DRDetailID);
                                            const meta = getMeta(detail.DRDetailID);
                                            const fallbackRow: ItemRowState = {
                                                conditionId: '',
                                                remarks: '',
                                                quantity: detail.QuantityDelivered,
                                            };
                                            const displayRows: ItemRowState[] = rows.length > 0 ? rows : [fallbackRow];
                                            const totalUsed = rows.reduce((sum, row) => sum + getRowQuantity(row), 0);
                                            const remaining = Math.max(0, detail.QuantityDelivered - totalUsed);
                                            const detailChanged = meta ? hasDetailChanges(detail.DRDetailID, meta) : false;
                                            return (
                                                <div key={detail.DRDetailID} className="border border-slate-200 rounded-lg p-4">
                                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                                        <div>
                                                            <p className="font-semibold text-slate-900">{detail.ItemDescription}</p>
                                                            <p className="text-xs text-slate-500">Qty: {detail.QuantityDelivered} {(detail.unitOfMeasure || detail.unit_of_measure)?.UnitName || ''}</p>
                                                        </div>
                                                        <div className="text-xs text-slate-600">
                                                            {isItemComplete(detail.DRDetailID, detail.QuantityDelivered) ? 'Ready to complete' : 'Incomplete'}
                                                        </div>
                                                    </div>
                                                    {meta && (
                                                        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                                                            <div>
                                                                <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Brand</label>
                                                                <input
                                                                    value={meta.brand}
                                                                    onChange={(event) => updateMeta(detail.DRDetailID, { brand: event.target.value })}
                                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                                                    placeholder="Brand"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Model</label>
                                                                <input
                                                                    value={meta.modelNumber}
                                                                    onChange={(event) => updateMeta(detail.DRDetailID, { modelNumber: event.target.value })}
                                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                                                    placeholder="Model number"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Serial Number</label>
                                                                <input
                                                                    value={meta.serialNumber}
                                                                    onChange={(event) => updateMeta(detail.DRDetailID, { serialNumber: event.target.value })}
                                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 disabled:bg-slate-100"
                                                                    placeholder="Serial number"
                                                                    disabled={meta.noSerial}
                                                                />
                                                                <label className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={meta.noSerial}
                                                                        onChange={(event) => updateMeta(detail.DRDetailID, { noSerial: event.target.checked })}
                                                                    />
                                                                    No serial number
                                                                </label>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {detailChanged && meta && (
                                                        <div className="mt-3">
                                                            <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Change Reason</label>
                                                            <input
                                                                value={meta.changeReason}
                                                                onChange={(event) => updateMeta(detail.DRDetailID, { changeReason: event.target.value })}
                                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                                                placeholder="Why is this different from the DR/PO?"
                                                            />
                                                        </div>
                                                    )}
                                                    <div className="mt-4 space-y-4">
                                                        {displayRows.map((row, rowIndex) => {
                                                            const usedByOthers = rows.reduce((sum, item, index) => {
                                                                return index === rowIndex ? sum : sum + getRowQuantity(item);
                                                            }, 0);
                                                            const maxQty = Math.max(0, detail.QuantityDelivered - usedByOthers);
                                                            const mode = row.conditionId ? getConditionMode(row.conditionId) : 'unknown';
                                                            const qty = getRowQuantity(row);
                                                            const quantityLabel = mode === 'accept'
                                                                ? 'Quantity (Accepted)'
                                                                : mode === 'reject'
                                                                    ? 'Quantity (Rejected)'
                                                                    : 'Quantity';
                                                            return (
                                                                <div key={`${detail.DRDetailID}-${rowIndex}`} className="border border-slate-200 rounded-lg p-3 bg-slate-50/40">
                                                                    <div className="flex items-center justify-between mb-3">
                                                                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                                                            Condition Row {rowIndex + 1}
                                                                        </div>
                                                                        {displayRows.length > 1 && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => removeRow(detail.DRDetailID, rowIndex)}
                                                                                className="text-xs text-red-500 hover:text-red-600"
                                                                            >
                                                                                Remove
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
                                                                        <div>
                                                                            <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Condition</label>
                                                                            <select
                                                                                value={row.conditionId}
                                                                                onChange={(event) => updateRow(detail.DRDetailID, rowIndex, { conditionId: event.target.value ? Number(event.target.value) : '' })}
                                                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                                                            >
                                                                                <option value="">Select condition</option>
                                                                                {conditions?.map((condition) => (
                                                                                    <option key={condition.ConditionID} value={condition.ConditionID}>
                                                                                        {condition.ConditionName}
                                                                                    </option>
                                                                                ))}
                                                                            </select>
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">
                                                                                {quantityLabel}
                                                                            </label>
                                                                            <input
                                                                                type="number"
                                                                                min={0}
                                                                                max={maxQty}
                                                                                value={row.quantity}
                                                                                onChange={(event) => updateRow(detail.DRDetailID, rowIndex, { quantity: Math.min(Math.max(0, Number(event.target.value || 0)), maxQty) })}
                                                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                                                            />
                                                                            {mode !== 'unknown' && (
                                                                                <div className="mt-1 text-xs text-slate-400">
                                                                                    Accepted: {mode === 'accept' ? qty : 0} · Rejected: {mode === 'reject' ? qty : 0}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    {mode === 'reject' && row.conditionId && (
                                                                        <div className="mt-3">
                                                                            <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Reject Reason</label>
                                                                            <input
                                                                                value={row.remarks}
                                                                                onChange={(event) => updateRow(detail.DRDetailID, rowIndex, { remarks: event.target.value })}
                                                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                                                                placeholder="Why is this rejected? (required)"
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    <div className="mt-3">
                                                        <button
                                                            type="button"
                                                            onClick={() => addRow(detail.DRDetailID, remaining)}
                                                            disabled={remaining === 0}
                                                            className="text-xs text-[var(--primary)] hover:text-[var(--primary)]/80 disabled:text-slate-400 disabled:cursor-not-allowed"
                                                        >
                                                            + Add condition row {remaining > 0 ? `(remaining ${remaining})` : ''}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={handleSave}
                                        disabled={isSaving || isCompleting}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                                        Save Inspection
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleComplete}
                                        disabled={!canComplete || isSaving || isCompleting}
                                        className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isCompleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                        Mark Inspection Complete
                                    </button>
                                    <span className="text-xs text-slate-600">Status: {reportId ? (canComplete ? 'Ready to complete' : 'Draft saved') : 'Not saved'}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

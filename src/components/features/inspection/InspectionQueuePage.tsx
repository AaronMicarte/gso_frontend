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

type ItemState = {
    remarks: string;
    brand: string;
    modelNumber: string;
    serialNumber: string;
    noSerial: boolean;
    changeReason: string;
    conditionId: number | '';
    quantityAccepted: number;
    quantityRejected: number;
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
    const [items, setItems] = useState<Record<number, ItemState>>({});
    const [originalDetails, setOriginalDetails] = useState<Record<number, OriginalDetail>>({});

    const { data, isLoading } = usePendingInspectionReceipts({ per_page: 50 });
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
            setItems({});
            setOriginalDetails({});
            return;
        }

        const draft = receipt.iar || null;
        setReportId(draft?.IARID || null);
        setRemarks(draft?.Remarks || '');

        const initial: Record<number, ItemState> = {};
        const originals: Record<number, OriginalDetail> = {};
        receipt.details?.forEach((detail) => {
            const existing = draft?.details?.find((item) => item.DRDetailID === detail.DRDetailID);
            const brand = detail.Brand || '';
            const modelNumber = detail.ModelNumber || '';
            const serialNumber = detail.SerialNumber || '';
            initial[detail.DRDetailID] = {
                remarks: existing?.Remarks || '',
                brand: existing?.VerifiedBrand || brand,
                modelNumber: existing?.VerifiedModel || modelNumber,
                serialNumber: existing?.VerifiedSerial || serialNumber,
                noSerial: existing?.NoSerial ?? false,
                changeReason: '',
                conditionId: existing?.ConditionID ?? '',
                quantityAccepted: existing?.QuantityAccepted ?? detail.QuantityDelivered,
                quantityRejected: existing?.QuantityRejected ?? 0,
            };
            originals[detail.DRDetailID] = {
                brand,
                modelNumber,
                serialNumber,
            };
        });

        setItems(initial);
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

    const totalItems = selected?.details?.length || 0;
    const isItemComplete = (detailId: number, delivered: number) => {
        const state = items[detailId];
        if (!state) return false;
        if (!normalizeValue(state.brand) || !normalizeValue(state.modelNumber)) return false;
        if (!state.noSerial && !normalizeValue(state.serialNumber)) return false;
        if (!state.conditionId) return false;
        if (state.quantityAccepted + state.quantityRejected !== delivered) return false;
        return true;
    };
    const inspectedCount = selected?.details?.filter((detail) => isItemComplete(detail.DRDetailID, detail.QuantityDelivered)).length || 0;
    const canComplete = totalItems > 0 && inspectedCount === totalItems && reportId !== null;

    const hasDetailChanges = (detailId: number) => {
        const current = items[detailId];
        const original = originalDetails[detailId];
        if (!current || !original) return false;
        return (
            normalizeValue(current.brand) !== normalizeValue(original.brand) ||
            normalizeValue(current.modelNumber) !== normalizeValue(original.modelNumber) ||
            normalizeValue(current.serialNumber) !== normalizeValue(original.serialNumber)
        );
    };

    const validateItemDetails = () => {
        if (!selected?.details) return true;
        for (const detail of selected.details) {
            const state = items[detail.DRDetailID];
            if (!state) continue;

            if (!normalizeValue(state.brand) || !normalizeValue(state.modelNumber)) {
                toast.error('Brand and model are required for inspection.');
                return false;
            }
            if (!state.noSerial && !normalizeValue(state.serialNumber)) {
                toast.error('Serial number is required or mark no serial.');
                return false;
            }
            if (!state.conditionId) {
                toast.error('Condition is required for each item.');
                return false;
            }
            if (state.quantityAccepted + state.quantityRejected !== detail.QuantityDelivered) {
                toast.error('Accepted + rejected must equal delivered quantity.');
                return false;
            }

            if (hasDetailChanges(detail.DRDetailID) && !normalizeValue(state.changeReason)) {
                toast.error('Provide a reason for brand/model/serial changes.');
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

        const payloadItems = selected.details?.map((detail) => {
            const state = items[detail.DRDetailID];
            return {
                dr_detail_id: detail.DRDetailID,
                condition_id: typeof state?.conditionId === 'number' ? state.conditionId : 0,
                quantity_accepted: state?.quantityAccepted ?? 0,
                quantity_rejected: state?.quantityRejected ?? 0,
                verified_brand: state?.brand ? normalizeValue(state.brand) : null,
                verified_model: state?.modelNumber ? normalizeValue(state.modelNumber) : null,
                verified_serial: state?.serialNumber ? normalizeValue(state.serialNumber) : null,
                no_serial: state?.noSerial || false,
                remarks: state?.remarks || '',
                change_reason: state?.changeReason ? normalizeValue(state.changeReason) : undefined,
            };
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
        <div className="min-h-screen bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')" }}>
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

                        {isLoading ? (
                            <div className="flex items-center justify-center py-12 text-slate-500 text-sm">
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                Loading pending inspections...
                            </div>
                        ) : filtered.length === 0 ? (
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
                                            const state = items[detail.DRDetailID] || {
                                                remarks: '',
                                                brand: '',
                                                modelNumber: '',
                                                serialNumber: '',
                                                noSerial: false,
                                                changeReason: '',
                                                conditionId: '',
                                                quantityAccepted: 0,
                                                quantityRejected: 0,
                                            };
                                            const detailChanged = hasDetailChanges(detail.DRDetailID);
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
                                                    <div className="mt-3">
                                                        <input
                                                            value={state.remarks}
                                                            onChange={(event) => setItems((prev) => ({
                                                                ...prev,
                                                                [detail.DRDetailID]: {
                                                                    ...prev[detail.DRDetailID],
                                                                    remarks: event.target.value,
                                                                },
                                                            }))}
                                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                                            placeholder="Item remarks (damaged, incomplete, etc.)"
                                                        />
                                                    </div>
                                                    <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                                                        <div>
                                                            <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Condition</label>
                                                            <select
                                                                value={state.conditionId}
                                                                onChange={(event) => setItems((prev) => ({
                                                                    ...prev,
                                                                    [detail.DRDetailID]: {
                                                                        ...prev[detail.DRDetailID],
                                                                        conditionId: event.target.value ? Number(event.target.value) : '',
                                                                    },
                                                                }))}
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
                                                            <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Accepted</label>
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                max={detail.QuantityDelivered}
                                                                value={state.quantityAccepted}
                                                                onChange={(event) => setItems((prev) => ({
                                                                    ...prev,
                                                                    [detail.DRDetailID]: {
                                                                        ...prev[detail.DRDetailID],
                                                                        quantityAccepted: Math.max(0, Number(event.target.value || 0)),
                                                                    },
                                                                }))}
                                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Rejected</label>
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                max={detail.QuantityDelivered}
                                                                value={state.quantityRejected}
                                                                onChange={(event) => setItems((prev) => ({
                                                                    ...prev,
                                                                    [detail.DRDetailID]: {
                                                                        ...prev[detail.DRDetailID],
                                                                        quantityRejected: Math.max(0, Number(event.target.value || 0)),
                                                                    },
                                                                }))}
                                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Brand</label>
                                                            <input
                                                                value={state.brand}
                                                                onChange={(event) => setItems((prev) => ({
                                                                    ...prev,
                                                                    [detail.DRDetailID]: {
                                                                        ...prev[detail.DRDetailID],
                                                                        brand: event.target.value,
                                                                    },
                                                                }))}
                                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                                                placeholder="Brand"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Model</label>
                                                            <input
                                                                value={state.modelNumber}
                                                                onChange={(event) => setItems((prev) => ({
                                                                    ...prev,
                                                                    [detail.DRDetailID]: {
                                                                        ...prev[detail.DRDetailID],
                                                                        modelNumber: event.target.value,
                                                                    },
                                                                }))}
                                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                                                placeholder="Model number"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Serial Number</label>
                                                            <input
                                                                value={state.serialNumber}
                                                                onChange={(event) => setItems((prev) => ({
                                                                    ...prev,
                                                                    [detail.DRDetailID]: {
                                                                        ...prev[detail.DRDetailID],
                                                                        serialNumber: event.target.value,
                                                                    },
                                                                }))}
                                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 disabled:bg-slate-100"
                                                                placeholder="Serial number"
                                                                disabled={state.noSerial}
                                                            />
                                                            <label className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={state.noSerial}
                                                                    onChange={(event) => setItems((prev) => ({
                                                                        ...prev,
                                                                        [detail.DRDetailID]: {
                                                                            ...prev[detail.DRDetailID],
                                                                            noSerial: event.target.checked,
                                                                        },
                                                                    }))}
                                                                />
                                                                No serial number
                                                            </label>
                                                        </div>
                                                    </div>
                                                    {detailChanged && (
                                                        <div className="mt-3">
                                                            <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Change Reason</label>
                                                            <input
                                                                value={state.changeReason}
                                                                onChange={(event) => setItems((prev) => ({
                                                                    ...prev,
                                                                    [detail.DRDetailID]: {
                                                                        ...prev[detail.DRDetailID],
                                                                        changeReason: event.target.value,
                                                                    },
                                                                }))}
                                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                                                placeholder="Why is this different from the DR/PO?"
                                                            />
                                                        </div>
                                                    )}
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

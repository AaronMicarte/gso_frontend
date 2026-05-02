'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Camera, Edit3, Plus, QrCode, RefreshCw, Search, Trash2 } from 'lucide-react';
import type { IScannerControls } from '@zxing/browser';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import {
    createCurrentRpcInventoryCycle,
    deleteRpcScan,
    getRpcInventoryCycleScans,
    listRpcConditions,
    listRpcInventoryCycles,
    previewRpcScan,
    storeRpcScan,
    updateRpcScan,
} from '@/lib/api/rpcInventory';
import type {
    RpcInventoryCondition,
    RpcInventoryCycle,
    RpcInventoryPreviewAsset,
    RpcInventoryPreviewCandidate,
    RpcInventoryScanRecord,
    RpcType,
} from '@/types/rpcInventory';

type PreviewAssetState = RpcInventoryPreviewAsset & {
    group_total_count: number;
    group_scanned_count: number;
    group_remaining_count: number;
    candidates: RpcInventoryPreviewCandidate[];
};

type ParsedRpcScanTarget = {
    propertyId?: number;
    inventoryDetailId?: number;
    inventoryDetailMissing?: boolean;
};

function parseRpcScanTarget(raw: string): ParsedRpcScanTarget | null {
    const value = raw.trim();
    if (!value) return null;

    const direct = Number(value);
    if (Number.isInteger(direct) && direct > 0) {
        return { propertyId: direct };
    }

    const parsePath = (pathname: string, search = ''): ParsedRpcScanTarget | null => {
        const qs = new URLSearchParams(search);
        const detailParam = qs.get('detail');
        const parsedDetailId = detailParam ? Number(detailParam) : NaN;
        const inventoryDetailId = Number.isInteger(parsedDetailId) && parsedDetailId > 0 ? parsedDetailId : undefined;

        const qrMatch = pathname.match(/\/qr\/scan\/(\d+)/);
        if (qrMatch?.[1]) {
            const id = Number(qrMatch[1]);
            if (Number.isInteger(id) && id > 0) return { propertyId: id };
        }

        const inventoryMatch = pathname.match(/\/(?:(admin|staff|department_head)\/)?inventory\/(\d+)/);
        if (inventoryMatch?.[2]) {
            if (!inventoryDetailId) {
                return { inventoryDetailMissing: true };
            }
            return { inventoryDetailId };
        }

        return null;
    };

    try {
        const asUrl = new URL(value);
        return parsePath(asUrl.pathname, asUrl.search);
    } catch {
        // not a URL
    }

    const routeLike = value.match(/^(\/[^\s?#]+)(\?[^\s#]+)?(#[^\s]+)?$/);
    if (routeLike?.[1]) {
        return parsePath(routeLike[1], routeLike[2] ?? '');
    }

    const match = value.match(/\/qr\/scan\/(\d+)/);
    if (match?.[1]) {
        const id = Number(match[1]);
        if (Number.isInteger(id) && id > 0) return { propertyId: id };
    }

    return null;
}

export function RpcInventoryPage() {
    const [cycles, setCycles] = useState<RpcInventoryCycle[]>([]);
    const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null);

    const [conditions, setConditions] = useState<RpcInventoryCondition[]>([]);

    const [scanMode, setScanMode] = useState<'paste' | 'camera'>('paste');
    const [scanInput, setScanInput] = useState('');

    const [loadingCycles, setLoadingCycles] = useState(false);
    const [loadingScans, setLoadingScans] = useState(false);
    const [submittingScan, setSubmittingScan] = useState(false);
    const [previewProcessing, setPreviewProcessing] = useState(false);

    const [scans, setScans] = useState<RpcInventoryScanRecord[]>([]);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<'ALL' | RpcType>('ALL');
    const [propertyTypeFilter, setPropertyTypeFilter] = useState<string>('ALL');

    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewAsset, setPreviewAsset] = useState<PreviewAssetState | null>(null);
    const [alreadyScanned, setAlreadyScanned] = useState(false);
    const [selectedInventoryDetailIds, setSelectedInventoryDetailIds] = useState<number[]>([]);
    const [conditionId, setConditionId] = useState<number>(0);
    const [scanRemarks, setScanRemarks] = useState('');

    const [editOpen, setEditOpen] = useState(false);
    const [editingScan, setEditingScan] = useState<RpcInventoryScanRecord | null>(null);
    const [editConditionId, setEditConditionId] = useState<number>(0);
    const [editRemarks, setEditRemarks] = useState('');

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deletingScan, setDeletingScan] = useState<RpcInventoryScanRecord | null>(null);
    const [deletingScanLoading, setDeletingScanLoading] = useState(false);

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const controlsRef = useRef<IScannerControls | null>(null);
    const scanLockedRef = useRef(false);
    const [cameraReady, setCameraReady] = useState(false);

    const selectedCycle = useMemo(
        () => cycles.find((cycle) => cycle.id === selectedCycleId) ?? null,
        [cycles, selectedCycleId]
    );

    const availablePropertyTypes = useMemo(() => {
        const unique = new Set(
            scans
                .map((scan) => (scan.property_type || '').trim())
                .filter((name) => name.length > 0)
        );

        return Array.from(unique).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }, [scans]);

    const filteredScans = useMemo(() => {
        if (propertyTypeFilter === 'ALL') {
            return scans;
        }

        return scans.filter((scan) => (scan.property_type || '').trim() === propertyTypeFilter);
    }, [scans, propertyTypeFilter]);

    const loadCycles = async () => {
        try {
            setLoadingCycles(true);
            const response = await listRpcInventoryCycles();
            setCycles(response.data);
            if (response.data.length > 0 && !selectedCycleId) {
                setSelectedCycleId(response.data[0].id);
            }
        } catch {
            toast.error('Failed to load inventory cycles');
        } finally {
            setLoadingCycles(false);
        }
    };

    const loadConditions = async () => {
        try {
            const data = await listRpcConditions();
            setConditions(data);
            if (data.length > 0 && conditionId === 0) {
                setConditionId(data[0].ConditionID);
            }
        } catch {
            toast.error('Failed to load conditions');
        }
    };

    const loadScans = async () => {
        if (!selectedCycleId) return;

        try {
            setLoadingScans(true);
            const data = await getRpcInventoryCycleScans(selectedCycleId, {
                search: search.trim() || undefined,
                type: typeFilter === 'ALL' ? undefined : typeFilter,
                per_page: 100,
            });
            setScans(data.data);
        } catch {
            toast.error('Failed to load scanned assets');
        } finally {
            setLoadingScans(false);
        }
    };

    useEffect(() => {
        void loadCycles();
        void loadConditions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!selectedCycleId) return;
        void loadScans();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCycleId, typeFilter]);

    useEffect(() => {
        setPropertyTypeFilter('ALL');
    }, [selectedCycleId]);

    const startCamera = async () => {
        try {
            stopCamera();
            if (!videoRef.current) return;

            const { BrowserQRCodeReader } = await import('@zxing/browser');
            const reader = new BrowserQRCodeReader();
            scanLockedRef.current = false;

            const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
                if (!result) return;
                if (scanLockedRef.current) return;
                scanLockedRef.current = true;

                const value = result.getText();
                const parsed = parseRpcScanTarget(value);
                if (!parsed) {
                    toast.error('Unsupported QR content');
                    scanLockedRef.current = false;
                    return;
                }

                if (parsed.inventoryDetailMissing) {
                    toast.error('Invalid inventory QR', {
                        description: 'This QR must include ?detail={InventoryDetailID}. Please reprint per-item sticker.',
                    });
                    scanLockedRef.current = false;
                    return;
                }

                stopCamera();
                void handlePreview(parsed, value);
            });

            controlsRef.current = controls;
            setCameraReady(true);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to start camera';
            toast.error('Camera error', { description: message });
            setCameraReady(false);
        }
    };

    const stopCamera = () => {
        try {
            controlsRef.current?.stop();
        } catch {
            // noop
        } finally {
            controlsRef.current = null;
            scanLockedRef.current = false;
            const stream = (videoRef.current?.srcObject as MediaStream | null) ?? null;
            if (stream) {
                for (const track of stream.getTracks()) track.stop();
            }
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
            setCameraReady(false);
        }
    };

    useEffect(() => {
        if (scanMode === 'camera') {
            void startCamera();
        } else {
            stopCamera();
        }

        return () => stopCamera();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scanMode]);

    const handleCreateCurrentCycle = async () => {
        try {
            await createCurrentRpcInventoryCycle();
            toast.success('Current inventory cycle is ready.');
            await loadCycles();
        } catch {
            toast.error('Failed to create current cycle');
        }
    };

    const handlePreview = async (target: ParsedRpcScanTarget, rawValue?: string) => {
        if (!selectedCycleId) {
            toast.error('Select a cycle first.');
            return;
        }

        try {
            const preview = await previewRpcScan(selectedCycleId, {
                property_id: target.propertyId,
                inventory_detail_id: target.inventoryDetailId,
                property_number: !target.propertyId && !target.inventoryDetailId ? rawValue : undefined,
                qr_value: rawValue,
            });

            setPreviewAsset({
                ...preview.asset,
                group_total_count: preview.group_total_count,
                group_scanned_count: preview.group_scanned_count,
                group_remaining_count: preview.group_remaining_count,
                candidates: preview.candidates,
            });
            setAlreadyScanned(preview.already_scanned);
            const unscannedIds = preview.candidates
                .filter((candidate) => !candidate.is_scanned)
                .map((candidate) => candidate.inventory_detail_id);
            const defaultSelection = unscannedIds.includes(preview.asset.inventory_detail_id)
                ? [preview.asset.inventory_detail_id]
                : (unscannedIds[0] ? [unscannedIds[0]] : []);
            setSelectedInventoryDetailIds(defaultSelection);
            if (conditions.length > 0) {
                setConditionId(conditions[0].ConditionID);
            }
            setScanRemarks('');
            setPreviewOpen(true);
        } catch (error: unknown) {
            let errorMessage = 'Unable to preview scan';
            let errorDetails = '';

            if (typeof error === 'object' && error !== null && 'response' in error) {
                const axiosError = error as { response?: { status?: number; data?: { message?: string; cycle_id?: number; received?: Record<string, unknown>; input?: Record<string, unknown> } } };
                const status = axiosError.response?.status;
                const data = axiosError.response?.data;

                errorMessage = (typeof data?.message === 'string' ? data.message : `Request failed with status ${status}`);

                // Add diagnostic info if it's a 404 or 422
                if (status === 404) {
                    if (data?.cycle_id) {
                        errorDetails = `Cycle ID ${data.cycle_id} not found. Make sure you've created a cycle first.`;
                    } else {
                        errorDetails = data?.input ? JSON.stringify(data.input, null, 2) : 'Property not found in database.';
                    }
                } else if (status === 422) {
                    errorDetails = data?.received ? JSON.stringify(data.received, null, 2) : 'Invalid input provided.';
                }
            }

            toast.error(errorMessage, {
                description: errorDetails ? `${errorDetails}` : undefined,
            });

            if (scanMode === 'camera') {
                void startCamera();
            }
        }
    };

    const handleSubmitScan = async () => {
        if (!selectedCycleId || !previewAsset) return;
        if (!conditionId) {
            toast.error('Select a condition first.');
            return;
        }
        if (scanRemarks.length > 255) {
            toast.error('Remarks must be 255 characters or less.');
            return;
        }

        const candidates = previewAsset.candidates ?? [];
        const unscannedIds = new Set(candidates.filter((candidate) => !candidate.is_scanned).map((candidate) => candidate.inventory_detail_id));
        const selectedIds = Array.from(new Set(selectedInventoryDetailIds.filter((id) => unscannedIds.has(id))));

        if (selectedIds.length === 0) {
            toast.error('Select at least one unscanned property number.');
            return;
        }

        if (selectedIds.length > (previewAsset.group_remaining_count ?? 0)) {
            toast.error('Selected quantity exceeds remaining count for this asset group.');
            return;
        }

        try {
            setSubmittingScan(true);
            await storeRpcScan(selectedCycleId, {
                property_id: previewAsset.property_id ?? undefined,
                inventory_detail_id: previewAsset.inventory_detail_id,
                selected_inventory_detail_ids: selectedIds,
                condition_id: conditionId,
                quantity_per_count: 1,
                remarks: scanRemarks.trim() || undefined,
            });
            toast.success(selectedIds.length > 1 ? `${selectedIds.length} scans recorded.` : 'Scan recorded.');
            setPreviewOpen(false);
            setPreviewAsset(null);
            setSelectedInventoryDetailIds([]);
            await loadScans();
            await loadCycles();
            if (scanMode === 'camera') {
                void startCamera();
            }
        } catch (error: unknown) {
            const message =
                typeof error === 'object' &&
                    error !== null &&
                    'response' in error &&
                    typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === 'string'
                    ? (error as { response: { data: { message: string } } }).response.data.message
                    : 'Failed to record scan';
            toast.error(message);
            if (scanMode === 'camera') {
                void startCamera();
            }
        } finally {
            setSubmittingScan(false);
        }
    };

    const handleOpenEdit = (scan: RpcInventoryScanRecord) => {
        setEditingScan(scan);
        setEditConditionId(scan.condition_id);
        setEditRemarks(scan.remarks ?? '');
        setEditOpen(true);
    };

    const handleUpdateScan = async () => {
        if (!editingScan) return;
        if (!editConditionId) {
            toast.error('Select a condition first.');
            return;
        }
        if (editRemarks.length > 255) {
            toast.error('Remarks must be 255 characters or less.');
            return;
        }

        try {
            await updateRpcScan(editingScan.id, {
                condition_id: editConditionId,
                quantity_per_count: 1,
                remarks: editRemarks.trim() || null,
            });
            toast.success('Scan updated.');
            setEditOpen(false);
            setEditingScan(null);
            await loadScans();
        } catch {
            toast.error('Failed to update scan');
        }
    };

    const handleDeleteScan = (scan: RpcInventoryScanRecord) => {
        setDeletingScan(scan);
        setDeleteDialogOpen(true);
    };

    const handleConfirmDeleteScan = async () => {
        if (!deletingScan) return;

        try {
            setDeletingScanLoading(true);
            await deleteRpcScan(deletingScan.id);
            toast.success('Scan removed.');
            setDeleteDialogOpen(false);
            setDeletingScan(null);
            await loadScans();
            await loadCycles();
        } catch {
            toast.error('Failed to remove scan');
        } finally {
            setDeletingScanLoading(false);
        }
    };

    const onPreviewFromInput = async () => {
        if (!selectedCycleId) {
            toast.error('Select a cycle first.');
            return;
        }

        if (previewProcessing) {
            return;
        }

        const rawInput = scanInput.trim();
        if (!rawInput) {
            toast.error('Enter a Property ID, Property Number, or /qr/scan/{id} URL');
            return;
        }

        const parsed = parseRpcScanTarget(rawInput);

        if (parsed?.inventoryDetailMissing) {
            toast.error('Invalid inventory QR', {
                description: 'This QR must include ?detail={InventoryDetailID}. Please reprint per-item sticker.',
            });
            return;
        }

        const minDelay = new Promise((resolve) => window.setTimeout(resolve, 900));

        try {
            setPreviewProcessing(true);
            const preview = await previewRpcScan(selectedCycleId, {
                property_id: parsed?.propertyId,
                inventory_detail_id: parsed?.inventoryDetailId,
                property_number: !parsed || (!parsed.propertyId && !parsed.inventoryDetailId) ? rawInput : undefined,
                qr_value: rawInput,
            });

            setPreviewAsset({
                ...preview.asset,
                group_total_count: preview.group_total_count,
                group_scanned_count: preview.group_scanned_count,
                group_remaining_count: preview.group_remaining_count,
                candidates: preview.candidates,
            });
            setAlreadyScanned(preview.already_scanned);
            const unscannedIds = preview.candidates
                .filter((candidate) => !candidate.is_scanned)
                .map((candidate) => candidate.inventory_detail_id);
            const defaultSelection = unscannedIds.includes(preview.asset.inventory_detail_id)
                ? [preview.asset.inventory_detail_id]
                : (unscannedIds[0] ? [unscannedIds[0]] : []);
            setSelectedInventoryDetailIds(defaultSelection);
            if (conditions.length > 0) {
                setConditionId(conditions[0].ConditionID);
            }
            setScanRemarks('');
            setPreviewOpen(true);
        } catch (error: unknown) {
            let errorMessage = 'Unable to preview scan';
            let errorDetails = '';

            if (typeof error === 'object' && error !== null && 'response' in error) {
                const axiosError = error as { response?: { status?: number; data?: { message?: string; cycle_id?: number; received?: Record<string, unknown>; input?: Record<string, unknown> } } };
                const status = axiosError.response?.status;
                const data = axiosError.response?.data;

                errorMessage = (typeof data?.message === 'string' ? data.message : `Request failed with status ${status}`);

                // Add diagnostic info if it's a 404 or 422
                if (status === 404) {
                    if (data?.cycle_id) {
                        errorDetails = `Cycle ID ${data.cycle_id} not found. Make sure you've created a cycle first.`;
                    } else {
                        errorDetails = 'Property not found in database. Verify the QR code or property ID.';
                    }
                } else if (status === 422) {
                    errorDetails = 'Invalid input provided.';
                }
            }

            toast.error(errorMessage, {
                description: errorDetails ? `${errorDetails}` : undefined,
            });
        } finally {
            await minDelay;
            setPreviewProcessing(false);
        }
    };

    return (
        <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: 'fixed' }}>
            <div className="p-6 space-y-6">
                <Dialog
                    open={previewOpen}
                    onOpenChange={(open) => {
                        setPreviewOpen(open);
                        if (!open) {
                            setPreviewAsset(null);
                            setSelectedInventoryDetailIds([]);
                            setScanRemarks('');
                            if (scanMode === 'camera') {
                                void startCamera();
                            }
                        }
                    }}
                    title="Confirm Asset Scan"
                    description="Review classification and details before recording this scan."
                    onConfirm={handleSubmitScan}
                    confirmText="Confirm Scan"
                    cancelText="Cancel"
                    loading={submittingScan}
                    contentClassName="max-w-2xl"
                >
                    {previewAsset ? (
                        <div className="space-y-4">
                            {alreadyScanned && (
                                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 text-sm flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 mt-0.5" />
                                    The scanned property number is already counted in this cycle.
                                </div>
                            )}

                            {previewAsset.group_remaining_count === 0 && (
                                <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-rose-900 text-sm flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 mt-0.5" />
                                    All property numbers for this asset group are already scanned.
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                                    <div className="text-slate-500">RPC Type</div>
                                    <div className="font-semibold text-slate-900">{previewAsset.rpc_type}</div>
                                </div>
                                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                                    <div className="text-slate-500">Property Number</div>
                                    <div className="font-semibold text-slate-900">{previewAsset.property_number || '-'}</div>
                                </div>
                                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 md:col-span-2">
                                    <div className="text-slate-500">Article / Description</div>
                                    <div className="font-semibold text-slate-900">
                                        {previewAsset.article || '-'}
                                        <span className="font-normal"> - {previewAsset.description || '-'}</span>
                                    </div>
                                </div>
                                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                                    <div className="text-slate-500">Accountable Officer</div>
                                    <div className="font-semibold text-slate-900">{previewAsset.accountable_officer || '-'}</div>
                                </div>
                                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                                    <div className="text-slate-500">Department</div>
                                    <div className="font-semibold text-slate-900">{previewAsset.department_name || '-'}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <label className="text-sm">
                                    <span className="block text-slate-600 mb-1">Condition</span>
                                    <select
                                        value={conditionId}
                                        onChange={(e) => setConditionId(Number(e.target.value))}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                                    >
                                        {conditions.map((condition) => (
                                            <option key={condition.ConditionID} value={condition.ConditionID}>
                                                {condition.ConditionName}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="text-sm">
                                    <span className="block text-slate-600 mb-1">Quantity Counted</span>
                                    <input
                                        type="number"
                                        value={selectedInventoryDetailIds.length}
                                        readOnly
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-700"
                                    />
                                </label>
                                <label className="text-sm md:col-span-1">
                                    <span className="block text-slate-600 mb-1">Remarks</span>
                                    <input
                                        type="text"
                                        value={scanRemarks}
                                        onChange={(e) => setScanRemarks(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                                        placeholder="optional"
                                    />
                                </label>
                            </div>

                            <div className="rounded-lg border border-slate-200 p-3 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                    <div className="text-slate-700">
                                        <span className="font-semibold">Property Numbers in Group:</span>{' '}
                                        {previewAsset.group_total_count} total, {previewAsset.group_remaining_count} remaining
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            className="px-2.5 py-1.5 rounded border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                            disabled={previewAsset.group_remaining_count === 0}
                                            onClick={() => {
                                                const ids = (previewAsset.candidates ?? [])
                                                    .filter((candidate) => !candidate.is_scanned)
                                                    .map((candidate) => candidate.inventory_detail_id);
                                                setSelectedInventoryDetailIds(ids);
                                            }}
                                        >
                                            Select All Remaining
                                        </button>
                                        <button
                                            type="button"
                                            className="px-2.5 py-1.5 rounded border border-slate-200 text-slate-700 hover:bg-slate-50"
                                            onClick={() => setSelectedInventoryDetailIds([])}
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>

                                <div className="max-h-44 overflow-auto rounded border border-slate-200 divide-y divide-slate-100">
                                    {(previewAsset.candidates ?? []).map((candidate) => {
                                        const disabled = candidate.is_scanned;
                                        const checked = selectedInventoryDetailIds.includes(candidate.inventory_detail_id);

                                        return (
                                            <label
                                                key={candidate.inventory_detail_id}
                                                className={`flex items-center justify-between gap-3 px-3 py-2 text-sm ${disabled ? 'bg-slate-50 text-slate-400' : 'text-slate-800'}`}
                                            >
                                                <span className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        disabled={disabled}
                                                        checked={checked}
                                                        onChange={(e) => {
                                                            const next = new Set(selectedInventoryDetailIds);
                                                            if (e.target.checked) {
                                                                next.add(candidate.inventory_detail_id);
                                                            } else {
                                                                next.delete(candidate.inventory_detail_id);
                                                            }
                                                            setSelectedInventoryDetailIds(Array.from(next));
                                                        }}
                                                    />
                                                    <span className="font-medium">{candidate.property_number || '-'}</span>
                                                </span>
                                                <span className={`text-xs ${disabled ? 'text-rose-500' : 'text-emerald-600'}`}>
                                                    {disabled ? 'already scanned' : 'available'}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : null}
                </Dialog>

                <Dialog
                    open={editOpen}
                    onOpenChange={setEditOpen}
                    title="Edit Scanned Asset"
                    onConfirm={handleUpdateScan}
                    confirmText="Save Changes"
                    cancelText="Cancel"
                    contentClassName="max-w-xl"
                >
                    {editingScan ? (
                        <div className="space-y-3">
                            <div className="text-sm text-slate-600">
                                {editingScan.article || '-'} - {editingScan.property_number || '-'}
                            </div>

                            <label className="text-sm block">
                                <span className="block text-slate-600 mb-1">Condition</span>
                                <select
                                    value={editConditionId}
                                    onChange={(e) => setEditConditionId(Number(e.target.value))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                                >
                                    {conditions.map((condition) => (
                                        <option key={condition.ConditionID} value={condition.ConditionID}>
                                            {condition.ConditionName}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="text-sm block">
                                <span className="block text-slate-600 mb-1">Quantity Counted</span>
                                <input
                                    type="number"
                                    value={1}
                                    readOnly
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-700"
                                />
                            </label>

                            <label className="text-sm block">
                                <span className="block text-slate-600 mb-1">Remarks</span>
                                <input
                                    type="text"
                                    value={editRemarks}
                                    onChange={(e) => setEditRemarks(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                                    placeholder="optional"
                                />
                            </label>
                        </div>
                    ) : null}
                </Dialog>

                <Dialog
                    open={deleteDialogOpen}
                    onOpenChange={(open) => {
                        setDeleteDialogOpen(open);
                        if (!open) {
                            setDeletingScan(null);
                        }
                    }}
                    title="Remove Scanned Asset"
                    description="This will remove the scanned asset from the selected cycle."
                    onConfirm={handleConfirmDeleteScan}
                    confirmText="Remove"
                    cancelText="Cancel"
                    loading={deletingScanLoading}
                    contentClassName="max-w-md"
                >
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
                        {deletingScan
                            ? `Remove ${deletingScan.property_number || '-'} (${deletingScan.article || deletingScan.description || 'Asset'}) from this cycle?`
                            : 'Remove this scanned asset from the current cycle?'}
                    </div>
                </Dialog>

                <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2">
                            <p className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold tracking-wide text-slate-700">
                                QR Inventory Control
                            </p>
                            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">RPCPPE / RPCSEP Workspace</h1>
                            <p className="max-w-3xl text-sm text-slate-600">
                                Manage cycle-based physical counting, quick scan validation, and export-ready reports in one streamlined console.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" className="w-auto" onClick={() => void loadCycles()} isLoading={loadingCycles}>
                                <RefreshCw className="w-4 h-4" />
                            </Button>
                            <Button size="sm" className="w-auto bg-[var(--primary)] hover:bg-[var(--primary-hover)]" onClick={() => void handleCreateCurrentCycle()}>
                                <Plus className="w-4 h-4" /> Add New (Current Year)
                            </Button>
                        </div>
                    </div>
                </section>

                <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold tracking-[0.14em] uppercase text-slate-500">Inventory Cycles</div>
                        <div className="text-xs text-slate-500">{cycles.length} total</div>
                    </div>
                    {loadingCycles && cycles.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-600">Loading cycles...</div>
                    ) : cycles.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-600">
                            No cycles yet. Click Add New (Current Year) to create your first cycle.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                            {cycles.map((cycle) => {
                                const isSelected = cycle.id === selectedCycleId;
                                return (
                                    <button
                                        key={cycle.id}
                                        type="button"
                                        onClick={() => setSelectedCycleId(cycle.id)}
                                        className={`text-left rounded-xl border p-4 transition-all ${isSelected
                                            ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                                            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                                            }`}
                                    >
                                        <div className={`text-[11px] uppercase tracking-wide ${isSelected ? 'text-slate-200' : 'text-slate-500'}`}>{cycle.status}</div>
                                        <div className="font-semibold mt-1 line-clamp-2">{cycle.cycle_label}</div>
                                        <div className={`mt-3 text-sm grid grid-cols-3 gap-2 ${isSelected ? 'text-slate-100' : 'text-slate-600'}`}>
                                            <div>
                                                <div className="text-[10px] uppercase">Total</div>
                                                <div className="font-semibold">{cycle.scans_count}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] uppercase">PPE</div>
                                                <div className="font-semibold">{cycle.rpcppe_count}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] uppercase">SEP</div>
                                                <div className="font-semibold">{cycle.rpcsep_count}</div>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </section>

                {!selectedCycle && cycles.length === 0 && !loadingCycles && (
                    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 md:p-6 space-y-4">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                                <h3 className="font-semibold text-amber-900">No Inventory Cycles Available</h3>
                                <p className="text-sm text-amber-800 mt-2">
                                    To begin RPC (RPCPPE/RPCSEP) scanning, you need to create an inventory cycle for the current year.
                                </p>
                                <button
                                    onClick={handleCreateCurrentCycle}
                                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
                                >
                                    <Plus className="w-4 h-4" />
                                    Create Current Year Cycle
                                </button>
                            </div>
                        </div>
                    </section>
                )}

                {selectedCycle ? (
                    <>
                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                            <div className="xl:col-span-8 rounded-2xl border border-slate-200 bg-white p-4 md:p-5 space-y-4 shadow-sm">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Scanner</div>
                                        <div className="font-semibold text-slate-900 text-lg">{selectedCycle.cycle_label}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Link
                                            href={`/qr/rpc-inventory/${selectedCycle.id}/print?type=RPCPPE`}
                                            target="_blank"
                                            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50"
                                        >
                                            Generate RPCPPE Report
                                        </Link>
                                        <Link
                                            href={`/qr/rpc-inventory/${selectedCycle.id}/print?type=RPCSEP`}
                                            target="_blank"
                                            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50"
                                        >
                                            Generate RPCSEP Report
                                        </Link>
                                    </div>
                                </div>

                                <div className="bg-slate-100 rounded-xl p-1 inline-flex gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setScanMode('paste')}
                                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${scanMode === 'paste' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        <QrCode className="w-4 h-4 inline mr-1" /> Paste / Manual
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setScanMode('camera')}
                                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${scanMode === 'camera' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        <Camera className="w-4 h-4 inline mr-1" /> Camera
                                    </button>
                                </div>

                                {scanMode === 'paste' ? (
                                    <div className="flex flex-col md:flex-row gap-2">
                                        <input
                                            value={scanInput}
                                            onChange={(e) => setScanInput(e.target.value)}
                                            placeholder="Property ID, Property Number, or /qr/scan/{id} URL"
                                            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl"
                                        />
                                        <Button
                                            className="w-auto bg-[var(--primary)] hover:bg-[var(--primary-hover)]"
                                            size="sm"
                                            onClick={() => void onPreviewFromInput()}
                                            disabled={previewProcessing}
                                        >
                                            {previewProcessing ? 'Processing...' : 'Preview Scan'}
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="rounded-xl overflow-hidden border border-slate-200 bg-black">
                                            <video ref={videoRef} className="w-full h-[340px] object-cover" muted playsInline />
                                        </div>
                                        <div className="text-sm text-slate-600">
                                            {cameraReady ? 'Point the camera to a property QR code.' : 'Starting camera...'}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <aside className="xl:col-span-4 rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
                                <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Cycle Snapshot</div>
                                <div className="mt-2 font-semibold text-slate-900">{selectedCycle.cycle_label}</div>
                                <div className="mt-4 grid grid-cols-3 gap-2">
                                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                                        <div className="text-[10px] uppercase text-slate-500">Total</div>
                                        <div className="text-xl font-black text-slate-900">{selectedCycle.scans_count}</div>
                                    </div>
                                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                                        <div className="text-[10px] uppercase text-slate-500">RPCPPE</div>
                                        <div className="text-xl font-black text-slate-900">{selectedCycle.rpcppe_count}</div>
                                    </div>
                                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                                        <div className="text-[10px] uppercase text-slate-500">RPCSEP</div>
                                        <div className="text-xl font-black text-slate-900">{selectedCycle.rpcsep_count}</div>
                                    </div>
                                </div>
                                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                                    Use filters below to review scans, then open row actions to edit condition or remove a scan.
                                </div>
                            </aside>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
                                <div className="font-semibold text-slate-900">Scanned Assets</div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="relative">
                                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder="Search property/article"
                                            className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                                        />
                                    </div>
                                    <select
                                        value={typeFilter}
                                        onChange={(e) => setTypeFilter(e.target.value as 'ALL' | RpcType)}
                                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                                    >
                                        <option value="ALL">All Types</option>
                                        <option value="RPCPPE">RPCPPE</option>
                                        <option value="RPCSEP">RPCSEP</option>
                                    </select>
                                    <select
                                        value={propertyTypeFilter}
                                        onChange={(e) => setPropertyTypeFilter(e.target.value)}
                                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                                    >
                                        <option value="ALL">All Property Types</option>
                                        {availablePropertyTypes.map((propertyType) => (
                                            <option key={propertyType} value={propertyType}>
                                                {propertyType}
                                            </option>
                                        ))}
                                    </select>
                                    <Button size="sm" variant="outline" className="w-auto" onClick={() => void loadScans()}>
                                        Refresh
                                    </Button>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-100 text-slate-700">
                                        <tr>
                                            <th className="text-left px-4 py-3">Type</th>
                                            <th className="text-left px-4 py-3">Property Number</th>
                                            <th className="text-left px-4 py-3">Article</th>
                                            <th className="text-left px-4 py-3">Officer</th>
                                            <th className="text-left px-4 py-3">Condition</th>
                                            <th className="text-left px-4 py-3">Count</th>
                                            <th className="text-right px-4 py-3">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {loadingScans ? (
                                            <tr>
                                                <td className="px-4 py-8 text-center text-slate-500" colSpan={7}>
                                                    Loading scanned assets...
                                                </td>
                                            </tr>
                                        ) : filteredScans.length === 0 ? (
                                            <tr>
                                                <td className="px-4 py-8 text-center text-slate-500" colSpan={7}>
                                                    No scanned assets yet for this cycle.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredScans.map((scan) => (
                                                <tr key={scan.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3 font-medium">{scan.rpc_type}</td>
                                                    <td className="px-4 py-3">{scan.property_number || '-'}</td>
                                                    <td className="px-4 py-3">{scan.article || scan.description || '-'}</td>
                                                    <td className="px-4 py-3">{scan.accountable_officer || '-'}</td>
                                                    <td className="px-4 py-3">{scan.condition?.ConditionName || '-'}</td>
                                                    <td className="px-4 py-3">{scan.quantity_per_count}</td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="inline-flex gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenEdit(scan)}
                                                                className="p-2 rounded-md border border-slate-200 hover:bg-slate-100"
                                                                title="Edit"
                                                            >
                                                                <Edit3 className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteScan(scan)}
                                                                className="p-2 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50"
                                                                title="Remove"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">
                        No cycle selected. Create a current-year cycle to start scanning.
                    </div>
                )}

            </div>
        </div>
    );
}
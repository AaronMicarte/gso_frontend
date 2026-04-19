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
    RpcInventoryScanRecord,
    RpcType,
} from '@/types/rpcInventory';

function parsePropertyId(raw: string): number | null {
    const value = raw.trim();
    if (!value) return null;

    const direct = Number(value);
    if (Number.isInteger(direct) && direct > 0) return direct;

    const match = value.match(/\/qr\/scan\/(\d+)/);
    if (match?.[1]) {
        const id = Number(match[1]);
        if (Number.isInteger(id) && id > 0) return id;
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
    const [previewAsset, setPreviewAsset] = useState<RpcInventoryPreviewAsset | null>(null);
    const [alreadyScanned, setAlreadyScanned] = useState(false);
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

            const { BrowserMultiFormatReader } = await import('@zxing/browser');
            const reader = new BrowserMultiFormatReader();

            const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
                if (!result) return;

                const value = result.getText();
                const propertyId = parsePropertyId(value);
                if (!propertyId) {
                    toast.error('Unsupported QR content');
                    return;
                }

                stopCamera();
                void handlePreview(propertyId, value);
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

    const handlePreview = async (propertyId: number, rawValue?: string) => {
        if (!selectedCycleId) {
            toast.error('Select a cycle first.');
            return;
        }

        try {
            const preview = await previewRpcScan(selectedCycleId, {
                property_id: propertyId,
                qr_value: rawValue,
            });

            setPreviewAsset(preview.asset);
            setAlreadyScanned(preview.already_scanned);
            if (conditions.length > 0) {
                setConditionId(conditions[0].ConditionID);
            }
            setScanRemarks('');
            setPreviewOpen(true);
        } catch (error: unknown) {
            const message =
                typeof error === 'object' &&
                    error !== null &&
                    'response' in error &&
                    typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === 'string'
                    ? (error as { response: { data: { message: string } } }).response.data.message
                    : 'Unable to preview scan';
            toast.error(message);
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

        try {
            setSubmittingScan(true);
            await storeRpcScan(selectedCycleId, {
                property_id: previewAsset.property_id ?? undefined,
                inventory_detail_id: previewAsset.inventory_detail_id,
                condition_id: conditionId,
                quantity_per_count: 1,
                remarks: scanRemarks.trim() || undefined,
            });
            toast.success('Scan recorded.');
            setPreviewOpen(false);
            setPreviewAsset(null);
            await loadScans();
            await loadCycles();
        } catch (error: unknown) {
            const message =
                typeof error === 'object' &&
                    error !== null &&
                    'response' in error &&
                    typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === 'string'
                    ? (error as { response: { data: { message: string } } }).response.data.message
                    : 'Failed to record scan';
            toast.error(message);
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

        const propertyId = parsePropertyId(rawInput);

        const minDelay = new Promise((resolve) => window.setTimeout(resolve, 900));

        try {
            setPreviewProcessing(true);
            const preview = await previewRpcScan(selectedCycleId, {
                property_id: propertyId ?? undefined,
                property_number: propertyId ? undefined : rawInput,
                qr_value: rawInput,
            });

            setPreviewAsset(preview.asset);
            setAlreadyScanned(preview.already_scanned);
            if (conditions.length > 0) {
                setConditionId(conditions[0].ConditionID);
            }
            setScanRemarks('');
            setPreviewOpen(true);
        } catch (error: unknown) {
            const message =
                typeof error === 'object' &&
                    error !== null &&
                    'response' in error &&
                    typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === 'string'
                    ? (error as { response: { data: { message: string } } }).response.data.message
                    : 'Unable to preview scan';
            toast.error(message);
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
                    onOpenChange={setPreviewOpen}
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
                                    This asset is already scanned in this cycle. Confirm will be blocked.
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
                                        value={1}
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

                <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-1">
                            <h1 className="text-2xl font-bold text-slate-900">RPCPPE / RPCSEP</h1>
                            <p className="text-sm text-slate-600 max-w-3xl">
                                Physical count cycles, QR scanning, and report generation for non-expendable and semi-expendable properties.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" className="w-auto" onClick={() => void loadCycles()} isLoading={loadingCycles}>
                                <RefreshCw className="w-4 h-4" />
                            </Button>
                            <Button size="sm" className="w-auto" onClick={() => void handleCreateCurrentCycle()}>
                                <Plus className="w-4 h-4" /> Add New (Current Year)
                            </Button>
                        </div>
                    </div>
                </div>

                <section className="space-y-3">
                    <div className="text-xs font-semibold tracking-wide uppercase text-slate-500 px-1">Inventory Cycles</div>
                    {loadingCycles && cycles.length === 0 ? (
                        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-600">Loading cycles...</div>
                    ) : cycles.length === 0 ? (
                        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-600">
                            No cycles yet. Click Add New (Current Year) to create your first cycle.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                                        <div className="text-xs uppercase tracking-wide opacity-80">{cycle.status}</div>
                                        <div className="font-semibold mt-1">{cycle.cycle_label}</div>
                                        <div className={`mt-3 text-sm ${isSelected ? 'text-slate-100' : 'text-slate-600'}`}>
                                            <div>Total Scans: {cycle.scans_count}</div>
                                            <div>RPCPPE: {cycle.rpcppe_count}</div>
                                            <div>RPCSEP: {cycle.rpcsep_count}</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </section>

                {selectedCycle ? (
                    <>
                        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4 shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-slate-500">Scanner</div>
                                    <div className="font-semibold text-slate-900">{selectedCycle.cycle_label}</div>
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

                            <div className="bg-slate-100 rounded-lg p-1 inline-flex gap-1">
                                <button
                                    type="button"
                                    onClick={() => setScanMode('paste')}
                                    className={`px-3 py-2 rounded-md text-sm ${scanMode === 'paste' ? 'bg-white shadow-sm' : 'text-slate-600'}`}
                                >
                                    <QrCode className="w-4 h-4 inline mr-1" /> Paste / Manual
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setScanMode('camera')}
                                    className={`px-3 py-2 rounded-md text-sm ${scanMode === 'camera' ? 'bg-white shadow-sm' : 'text-slate-600'}`}
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
                                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg"
                                    />
                                    <Button
                                        className="w-auto"
                                        size="sm"
                                        onClick={() => void onPreviewFromInput()}
                                        disabled={previewProcessing}
                                    >
                                        {previewProcessing ? 'Processing...' : 'Preview Scan'}
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="rounded-lg overflow-hidden border border-slate-200 bg-black">
                                        <video ref={videoRef} className="w-full h-[340px] object-cover" muted playsInline />
                                    </div>
                                    <div className="text-sm text-slate-600">
                                        {cameraReady ? 'Point the camera to a property QR code.' : 'Starting camera...'}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                                <div className="font-semibold text-slate-900">Scanned Assets</div>
                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder="Search property/article"
                                            className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm"
                                        />
                                    </div>
                                    <select
                                        value={typeFilter}
                                        onChange={(e) => setTypeFilter(e.target.value as 'ALL' | RpcType)}
                                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                    >
                                        <option value="ALL">All Types</option>
                                        <option value="RPCPPE">RPCPPE</option>
                                        <option value="RPCSEP">RPCSEP</option>
                                    </select>
                                    <select
                                        value={propertyTypeFilter}
                                        onChange={(e) => setPropertyTypeFilter(e.target.value)}
                                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
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
                                    <thead className="bg-slate-50 text-slate-600">
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
                                                    <td className="px-4 py-3">{scan.rpc_type}</td>
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
                    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-600">
                        No cycle selected. Create a current-year cycle to start scanning.
                    </div>
                )}

            </div>
        </div>
    );
}

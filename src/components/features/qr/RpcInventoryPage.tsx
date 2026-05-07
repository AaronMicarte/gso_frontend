'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Camera, Edit3, Plus, QrCode, RefreshCw, Search, Trash2 } from 'lucide-react';
import type { IScannerControls } from '@zxing/browser';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useAuth } from '@/lib/providers/AuthProvider';
import {
    createCurrentRpcInventoryCycle,
    deleteRpcScan,
    getRpcInventoryCycleAuditLogs,
    getRpcInventoryCycleScans,
    listRpcConditions,
    listRpcInventoryCycles,
    previewRpcScan,
    storeRpcScan,
    updateRpcScan,
} from '@/lib/api/rpcInventory';
import type {
    RpcInventoryCondition,
    RpcInventoryAuditLog,
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

type GroupedScanRow = {
    key: string;
    primaryScan: RpcInventoryScanRecord;
    groupScans: RpcInventoryScanRecord[];
    propertyNumbersPreview: string;
    propertyNumbersFull: string[];
    scansCount: number;
    createdMonth: string;
};

type EditScanItem = {
    scanId: number;
    propertyNumber: string;
    conditionId: number;
    included: boolean;
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
    const { user } = useAuth();
    const isAdmin = user?.UserRoleID === 1;

    const [cycles, setCycles] = useState<RpcInventoryCycle[]>([]);
    const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null);

    const [conditions, setConditions] = useState<RpcInventoryCondition[]>([]);

    const [scanMode, setScanMode] = useState<'paste' | 'camera'>('paste');
    const [scanInput, setScanInput] = useState('');

    const [loadingCycles, setLoadingCycles] = useState(false);
    const [loadingScans, setLoadingScans] = useState(false);
    const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);
    const [submittingScan, setSubmittingScan] = useState(false);
    const [previewProcessing, setPreviewProcessing] = useState(false);

    const [scans, setScans] = useState<RpcInventoryScanRecord[]>([]);
    const [auditLogs, setAuditLogs] = useState<RpcInventoryAuditLog[]>([]);
    const [scansPage, setScansPage] = useState(1);
    const [auditPage, setAuditPage] = useState(1);
    const [auditLastPage, setAuditLastPage] = useState(1);
    const [auditTotal, setAuditTotal] = useState(0);
    const [selectedAuditLog, setSelectedAuditLog] = useState<RpcInventoryAuditLog | null>(null);
    const [expandedAuditFields, setExpandedAuditFields] = useState<Set<string>>(new Set());
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
    const [editingGroup, setEditingGroup] = useState<GroupedScanRow | null>(null);
    const [editingItems, setEditingItems] = useState<EditScanItem[]>([]);
    const [editRemarks, setEditRemarks] = useState('');

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deletingGroup, setDeletingGroup] = useState<GroupedScanRow | null>(null);
    const [deletingGroupLoading, setDeletingGroupLoading] = useState(false);
    const [expandedPropertyGroups, setExpandedPropertyGroups] = useState<Set<string>>(new Set());

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

    // Normalize accountable officer by removing duplicate department suffixes
    const normalizeAccountableOfficer = (value?: string | null): string => {
        if (!value) return '';
        const parts = value.split('-').map((p) => p.trim());
        const seen = new Set<string>();
        const unique: string[] = [];
        for (const part of parts) {
            if (!seen.has(part)) {
                unique.push(part);
                seen.add(part);
            }
        }
        return unique.join(' - ');
    };

    // Group sibling assets like mobile app does
    const buildScanGroupKey = (scan: RpcInventoryScanRecord): string => {
        return [
            scan.rpc_type ?? '',
            scan.article ?? '',
            scan.description ?? '',
            normalizeAccountableOfficer(scan.accountable_officer),
            scan.property_type ?? '',
            scan.unit_of_measure ?? '',
            scan.unit_value ?? '',
        ]
            .map((part) => String(part).trim().toLowerCase())
            .join('|');
    };

    const extractPropertyNumbers = (groupScans: RpcInventoryScanRecord[]): string[] => {
        return Array.from(
            new Set(
                groupScans
                    .map((scan) => scan.property_number?.trim())
                    .filter((num) => num && num.length > 0) as string[]
            )
        ).sort();
    };

    const buildPropertyNumbersPreview = (groupScans: RpcInventoryScanRecord[]): string => {
        const propertyNumbers = extractPropertyNumbers(groupScans);

        if (propertyNumbers.length === 0) {
            return `${groupScans.length} item${groupScans.length === 1 ? '' : 's'}`;
        }

        if (propertyNumbers.length <= 3) {
            return propertyNumbers.join(', ');
        }

        return `${propertyNumbers.slice(0, 3).join(', ')} ...`;
    };

    const formatCreatedMonth = (value?: string | null): string => {
        if (!value) return '-';

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';

        return new Intl.DateTimeFormat('en-US', {
            month: 'long',
            year: 'numeric',
        }).format(date);
    };

    const formatCycleDate = (value?: string | null): string => {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';

        return new Intl.DateTimeFormat('en-US', {
            month: 'long',
            year: 'numeric',
        }).format(date);
    };

    const formatAuditActionLabel = (action: string): string => {
        return action
            .replace(/^scan_/, 'scan ')
            .replace(/^cycle_/, 'cycle ')
            .replace(/^sync_/, 'sync ')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase());
    };

    const conditionLabelById = useMemo(() => {
        return new Map(conditions.map((condition) => [condition.ConditionID, condition.ConditionName]));
    }, [conditions]);

    const formatAuditFieldValue = (key: string, value: unknown): string | null => {
        if (value === null || value === undefined || value === '') return '-';

        if (Array.isArray(value)) {
            const items = value
                .map((item) => formatAuditFieldValue(key, item))
                .filter((item): item is string => Boolean(item));

            return items.length > 0 ? items.join(', ') : null;
        }

        if (typeof value === 'object') {
            const entries = Object.entries(value as Record<string, unknown>)
                .map(([nestedKey, nestedValue]) => {
                    const formattedNestedValue = formatAuditFieldValue(nestedKey, nestedValue);
                    return formattedNestedValue ? `${formatAuditFieldLabel(nestedKey)}: ${formattedNestedValue}` : null;
                })
                .filter((item): item is string => Boolean(item));

            return entries.length > 0 ? entries.join(' | ') : null;
        }

        const normalizedKey = key.toLowerCase();
        const stringValue = String(value).trim();

        if (['inventory_detail_id', 'property_id', 'rpc_inventory_scan_id', 'performed_by_user_id', 'performed_by_device_id', 'client_uuid'].includes(normalizedKey)) {
            return null;
        }

        if (normalizedKey === 'condition_id' || normalizedKey.endsWith('_condition_id')) {
            const conditionId = Number(stringValue);
            return Number.isFinite(conditionId) ? conditionLabelById.get(conditionId) ?? 'Unknown condition' : null;
        }

        if (normalizedKey === 'source') {
            return stringValue.charAt(0).toUpperCase() + stringValue.slice(1);
        }

        if (normalizedKey === 'scanned_at') {
            const date = new Date(stringValue);
            if (!Number.isNaN(date.getTime())) {
                return date.toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                });
            }
        }

        return stringValue;
    };

    const formatAuditFieldLabel = (key: string): string => {
        if (key === 'condition_id') return 'Condition';
        if (key === 'previous_condition_id') return 'Before condition';
        if (key === 'new_condition_id') return 'After condition';
        if (key === 'property_number') return 'Property #';
        if (key === 'property_numbers') return 'Property numbers';
        if (key === 'sync_source') return 'Source';
        if (key === 'total') return 'Total';
        if (key === 'created') return 'Created';
        if (key === 'duplicates') return 'Duplicates';
        if (key === 'errors') return 'Errors';
        if (key === 'remarks') return 'Remarks';
        if (key === 'rpc_type') return 'RPC Type';
        if (key === 'scanned_at') return 'Scanned at';
        return key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
    };

    const summarizeAuditLog = (log: RpcInventoryAuditLog): string => {
        const details = log.details || {};
        const entries = [] as string[];

        if (typeof log.action === 'string' && log.action.startsWith('sync_batch')) {
            const created = typeof details.created === 'number' ? details.created : Number(details.created ?? 0);
            const duplicates = typeof details.duplicates === 'number' ? details.duplicates : Number(details.duplicates ?? 0);
            const errors = typeof details.errors === 'number' ? details.errors : Number(details.errors ?? 0);
            entries.push(`${created || 0} created`, `${duplicates || 0} duplicates`, `${errors || 0} errors`);
            return entries.join(' • ');
        }

        const propertyNumber = log.property_number || log.scan?.property_number;
        if (propertyNumber) {
            entries.push(`Property # ${propertyNumber}`);
        }

        const currentCondition =
            formatAuditFieldValue('condition_id', log.condition_id) ||
            formatAuditFieldValue('condition_id', log.scan?.condition_id ?? null);
        if (currentCondition) {
            entries.push(`Condition ${currentCondition}`);
        }

        const remarks = log.new_remarks || log.previous_remarks || (typeof details.remarks === 'string' ? details.remarks : null);
        if (remarks) {
            entries.push(`Remarks ${remarks}`);
        }

        const source = typeof details.source === 'string' ? details.source : log.source;
        if (source) {
            entries.push(`Source ${source.charAt(0).toUpperCase() + source.slice(1)}`);
        }

        return entries.length > 0 ? entries.join(' • ') : 'View details';
    };

    const formatDetailEntries = (log: RpcInventoryAuditLog): Array<{ key: string; label: string; value: string }> => {
        const details = log.details || {};
        const entries: Array<{ key: string; label: string; value: string }> = [];

        if (log.action === 'scan_updated') {
            const before = details.before as Record<string, unknown> | undefined;
            const after = details.after as Record<string, unknown> | undefined;

            const beforeCondition = before ? formatAuditFieldValue('previous_condition_id', before.condition_id) : null;
            const afterCondition = after ? formatAuditFieldValue('condition_id', after.condition_id) : null;
            const beforeRemarks = before && typeof before.remarks === 'string' ? before.remarks : null;
            const afterRemarks = after && typeof after.remarks === 'string' ? after.remarks : null;

            if (beforeCondition) entries.push({ key: 'before_condition_id', label: 'Before condition', value: beforeCondition });
            if (afterCondition) entries.push({ key: 'new_condition_id', label: 'After condition', value: afterCondition });
            if (beforeRemarks) entries.push({ key: 'previous_remarks', label: 'Before remarks', value: beforeRemarks });
            if (afterRemarks) entries.push({ key: 'remarks', label: 'After remarks', value: afterRemarks });
            return entries;
        }

        if (typeof log.action === 'string' && log.action.startsWith('sync_batch')) {
            const propertyNumbers = Array.isArray(details.property_numbers) ? details.property_numbers.filter((value): value is string => typeof value === 'string') : [];
            if (propertyNumbers.length > 0) {
                entries.push({ key: 'property_numbers', label: 'Property numbers', value: propertyNumbers.join(', ') });
            }
            if (typeof details.total === 'number' || typeof details.total === 'string') {
                entries.push({ key: 'total', label: 'Total', value: String(details.total) });
            }
            if (typeof details.created === 'number' || typeof details.created === 'string') {
                entries.push({ key: 'created', label: 'Created', value: String(details.created) });
            }
            if (typeof details.duplicates === 'number' || typeof details.duplicates === 'string') {
                entries.push({ key: 'duplicates', label: 'Duplicates', value: String(details.duplicates) });
            }
            if (typeof details.errors === 'number' || typeof details.errors === 'string') {
                entries.push({ key: 'errors', label: 'Errors', value: String(details.errors) });
            }
            if (typeof details.status === 'string') {
                entries.push({ key: 'status', label: 'Status', value: details.status.replace(/_/g, ' ') });
            }
            if (typeof details.source === 'string') {
                entries.push({ key: 'source', label: 'Source', value: details.source.charAt(0).toUpperCase() + details.source.slice(1) });
            }
            return entries;
        }

        const pairs: Array<[string, unknown]> = [
            ['property_number', log.property_number],
            ['condition_id', log.condition_id],
            ['previous_condition_id', log.previous_condition_id],
            ['previous_remarks', log.previous_remarks],
            ['new_remarks', log.new_remarks],
            ['rpc_type', details.rpc_type],
            ['remarks', details.remarks],
            ['source', details.source ?? log.source],
            ['scanned_at', details.scanned_at],
        ];

        pairs.forEach(([key, value]) => {
            const formattedValue = formatAuditFieldValue(key, value);
            if (formattedValue) {
                entries.push({ key, label: formatAuditFieldLabel(key), value: formattedValue });
            }
        });

        return entries;
    };

    const groupedScans = useMemo<GroupedScanRow[]>(() => {
        let filtered = scans;

        if (typeFilter !== 'ALL') {
            filtered = filtered.filter((scan) => scan.rpc_type === typeFilter);
        }

        if (propertyTypeFilter !== 'ALL') {
            filtered = filtered.filter((scan) => (scan.property_type || '').trim() === propertyTypeFilter);
        }

        const searchTerm = search.trim().toLowerCase();
        if (searchTerm.length > 0) {
            filtered = filtered.filter((scan) => {
                const haystack = [
                    scan.property_number,
                    scan.article,
                    scan.description,
                    scan.accountable_officer,
                ]
                    .map((value) => (value || '').trim().toLowerCase())
                    .join(' ');

                return haystack.includes(searchTerm);
            });
        }

        const grouped = new Map<string, RpcInventoryScanRecord[]>();
        for (const scan of filtered) {
            const key = buildScanGroupKey(scan);
            const bucket = grouped.get(key);
            if (bucket) {
                bucket.push(scan);
            } else {
                grouped.set(key, [scan]);
            }
        }

        return Array.from(grouped.entries()).map(([key, groupedList]) => {
            const sorted = [...groupedList].sort(
                (a, b) => new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime()
            );
            const oldestScan = [...sorted].sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            )[0];
            const propertyNumbers = extractPropertyNumbers(sorted);
            return {
                key,
                primaryScan: sorted[0],
                groupScans: sorted,
                propertyNumbersPreview: buildPropertyNumbersPreview(sorted),
                propertyNumbersFull: propertyNumbers,
                scansCount: sorted.length,
                createdMonth: formatCreatedMonth(oldestScan?.created_month || oldestScan?.created_at),
            };
        });
    }, [scans, propertyTypeFilter, search, typeFilter]);

    const SCANNED_ASSETS_PER_PAGE = 15;
    const scannedAssetsLastPage = Math.max(1, Math.ceil(groupedScans.length / SCANNED_ASSETS_PER_PAGE));

    const pagedGroupedScans = useMemo<GroupedScanRow[]>(() => {
        const start = (scansPage - 1) * SCANNED_ASSETS_PER_PAGE;
        return groupedScans.slice(start, start + SCANNED_ASSETS_PER_PAGE);
    }, [groupedScans, scansPage]);

    const handleRefreshAll = async () => {
        await loadCycles();
        await loadScans();
        await loadAuditLogs();
    };

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

    const loadAuditLogs = async () => {
        if (!selectedCycleId || !isAdmin) {
            setAuditLogs([]);
            setAuditTotal(0);
            setAuditLastPage(1);
            return;
        }

        try {
            setLoadingAuditLogs(true);
            const response = await getRpcInventoryCycleAuditLogs(selectedCycleId, {
                page: auditPage,
                per_page: 20,
            });
            setAuditLogs(response.data);
            setAuditTotal(response.total);
            setAuditLastPage(Math.max(1, response.last_page));
        } catch {
            toast.error('Failed to load audit trail');
        } finally {
            setLoadingAuditLogs(false);
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
        setScansPage(1);
        setAuditPage(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCycleId, typeFilter]);

    useEffect(() => {
        setScansPage(1);
    }, [search, propertyTypeFilter]);

    useEffect(() => {
        if (!selectedCycleId) return;
        void loadAuditLogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCycleId, auditPage, isAdmin]);

    useEffect(() => {
        if (scansPage > scannedAssetsLastPage) {
            setScansPage(scannedAssetsLastPage);
        }
    }, [scannedAssetsLastPage, scansPage]);

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

            // Initialize remarks based on first available remark from sibling scans in group
            const siblingScans = scans
                .filter((scan) => scan.inventory_detail_id === preview.asset.inventory_detail_id ||
                    preview.candidates.some((c) => c.inventory_detail_id === scan.inventory_detail_id))
                .sort((a, b) => new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime());

            const remarksFromSiblings = siblingScans.map(s => s.remarks).filter(r => r && r.trim());
            setScanRemarks(remarksFromSiblings[0] || '');
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
            setAuditPage(1);
            await loadAuditLogs();
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

    const handleOpenEdit = (group: GroupedScanRow) => {
        setEditingGroup(group);
        setEditingItems(
            group.groupScans.map((scan) => ({
                scanId: scan.id,
                propertyNumber: scan.property_number || '-',
                conditionId: scan.condition_id,
                included: true,
            }))
        );
        const remarkSeed = group.groupScans.find((scan) => (scan.remarks || '').trim().length > 0)?.remarks ?? '';
        setEditRemarks(remarkSeed);
        setEditOpen(true);
    };

    const handleUpdateGroupScans = async () => {
        if (!editingGroup) return;

        const selectedItems = editingItems.filter((item) => item.included);
        const removedItems = editingItems.filter((item) => !item.included);
        const sharedRemarks = editRemarks.trim();
        const selectedById = new Map(editingGroup.groupScans.map((scan) => [scan.id, scan]));
        const changedItems = selectedItems.filter((item) => {
            const original = selectedById.get(item.scanId);
            if (!original) return true;

            return original.condition_id !== item.conditionId || (original.remarks || '') !== sharedRemarks;
        });

        try {
            const updateJobs = changedItems.map((item) =>
                updateRpcScan(item.scanId, {
                    condition_id: item.conditionId,
                    quantity_per_count: 1,
                    remarks: sharedRemarks || null,
                })
            );
            const removeJobs = removedItems.map((item) => deleteRpcScan(item.scanId));

            if (updateJobs.length === 0 && removeJobs.length === 0) {
                toast.success('No changes detected.');
                return;
            }

            await Promise.all([...updateJobs, ...removeJobs]);

            const updatedCount = changedItems.length;
            const removedCount = removedItems.length;
            if (updatedCount > 0 && removedCount > 0) {
                toast.success(`${updatedCount} updated, ${removedCount} removed from scan.`);
            } else if (removedCount > 0) {
                toast.success(removedCount > 1 ? `${removedCount} scans removed from scan.` : 'Scan removed from group.');
            } else {
                toast.success(updatedCount > 1 ? `${updatedCount} scans updated.` : 'Scan updated.');
            }
            setEditOpen(false);
            setEditingGroup(null);
            setEditingItems([]);
            setEditRemarks('');
            await loadScans();
            setAuditPage(1);
            await loadAuditLogs();
        } catch {
            toast.error('Failed to update selected scans');
        }
    };

    const handleDeleteGroup = (group: GroupedScanRow) => {
        setDeletingGroup(group);
        setDeleteDialogOpen(true);
    };

    const handleConfirmDeleteGroup = async () => {
        if (!deletingGroup || !selectedCycleId) return;

        try {
            setDeletingGroupLoading(true);
            // Delete all scans in the group
            await Promise.all(deletingGroup.groupScans.map((scan) => deleteRpcScan(scan.id)));
            toast.success(`Removed ${deletingGroup.scansCount} scan${deletingGroup.scansCount === 1 ? '' : 's'}.`);
            setDeleteDialogOpen(false);
            setDeletingGroup(null);

            // Ensure UI updates immediately by removing from local state
            setScans((prevScans) =>
                prevScans.filter((scan) => !deletingGroup.groupScans.find((gs) => gs.id === scan.id))
            );

            // Then reload from server to ensure consistency
            await Promise.all([
                loadScans(),
                loadCycles(),
            ]);
            setAuditPage(1);
            await loadAuditLogs();
        } catch (error: unknown) {
            const errorMessage =
                typeof error === 'object' &&
                    error !== null &&
                    'response' in error &&
                    typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === 'string'
                    ? (error as { response: { data: { message: string } } }).response.data.message
                    : 'Failed to remove scan group';
            toast.error(errorMessage);
        } finally {
            setDeletingGroupLoading(false);
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

            // Initialize remarks based on first available remark from sibling scans in group
            const siblingScans = scans
                .filter((scan) => scan.inventory_detail_id === preview.asset.inventory_detail_id ||
                    preview.candidates.some((c) => c.inventory_detail_id === scan.inventory_detail_id))
                .sort((a, b) => new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime());

            const remarksFromSiblings = siblingScans.map(s => s.remarks).filter(r => r && r.trim());
            setScanRemarks(remarksFromSiblings[0] || '');
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
                    onOpenChange={(open) => {
                        setEditOpen(open);
                        if (!open) {
                            setEditingGroup(null);
                            setEditingItems([]);
                            setEditRemarks('');
                        }
                    }}
                    title="Edit Scanned Asset"
                    onConfirm={handleUpdateGroupScans}
                    confirmText="Save Changes"
                    cancelText="Cancel"
                    contentClassName="max-w-3xl"
                >
                    {editingGroup ? (
                        <div className="space-y-4">
                            <div className="text-sm text-slate-600">
                                {editingGroup.primaryScan.article || editingGroup.primaryScan.description || '-'}
                            </div>

                            <label className="text-sm block">
                                <span className="block text-slate-600 mb-1">Shared Remark</span>
                                <input
                                    type="text"
                                    value={editRemarks}
                                    onChange={(e) => setEditRemarks(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                                    placeholder="optional"
                                />
                            </label>

                            <div className="rounded-lg border border-slate-200 overflow-hidden">
                                <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    <div>Property Number</div>
                                    <div>Condition</div>
                                    <div>Status</div>
                                </div>
                                <div className="divide-y divide-slate-100 max-h-[360px] overflow-auto">
                                    {editingItems.map((item) => {
                                        const isEnabled = item.included;

                                        return (
                                            <div
                                                key={item.scanId}
                                                className={`grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] gap-3 px-4 py-3 items-center ${isEnabled ? 'bg-white' : 'bg-slate-50 text-slate-400'}`}
                                            >
                                                <div className="space-y-1">
                                                    <div className="font-semibold text-slate-900">{item.propertyNumber}</div>
                                                </div>

                                                <select
                                                    value={item.conditionId}
                                                    onChange={(e) => {
                                                        const nextConditionId = Number(e.target.value);
                                                        setEditingItems((prev) =>
                                                            prev.map((entry) =>
                                                                entry.scanId === item.scanId
                                                                    ? { ...entry, conditionId: nextConditionId }
                                                                    : entry
                                                            )
                                                        );
                                                    }}
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                                                >
                                                    {conditions.map((condition) => (
                                                        <option key={condition.ConditionID} value={condition.ConditionID}>
                                                            {condition.ConditionName}
                                                        </option>
                                                    ))}
                                                </select>

                                                <button
                                                    type="button"
                                                    className={`px-3 py-2 rounded-lg border text-sm font-medium ${isEnabled
                                                        ? 'border-rose-200 text-rose-600 hover:bg-rose-50'
                                                        : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                                                        }`}
                                                    onClick={() => {
                                                        setEditingItems((prev) =>
                                                            prev.map((entry) =>
                                                                entry.scanId === item.scanId
                                                                    ? { ...entry, included: !entry.included }
                                                                    : entry
                                                            )
                                                        );
                                                    }}
                                                >
                                                    {isEnabled ? 'Remove from scan' : 'Restore to scan'}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : null}
                </Dialog>

                <Dialog
                    open={deleteDialogOpen}
                    onOpenChange={(open) => {
                        setDeleteDialogOpen(open);
                        if (!open) {
                            setDeletingGroup(null);
                        }
                    }}
                    title="Remove Scanned Assets Group"
                    description="This will remove all scanned assets in this group from the selected cycle."
                    onConfirm={handleConfirmDeleteGroup}
                    confirmText="Remove"
                    cancelText="Cancel"
                    loading={deletingGroupLoading}
                    contentClassName="max-w-md"
                >
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
                        {deletingGroup
                            ? `Remove ${deletingGroup.scansCount} scanned asset${deletingGroup.scansCount === 1 ? '' : 's'} (${deletingGroup.propertyNumbersPreview}) from this cycle?`
                            : 'Remove this scanned asset group from the current cycle?'}
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
                            <Button size="sm" variant="outline" className="w-auto" onClick={() => void handleRefreshAll()} isLoading={loadingCycles}>
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
                                        <div className={`mt-1 text-xs ${isSelected ? 'text-slate-200' : 'text-slate-500'}`}>{formatCycleDate(cycle.started_at)}</div>
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
                                <div className="mt-1 text-sm text-slate-500">{formatCycleDate(selectedCycle.started_at)}</div>
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
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-100 text-slate-700">
                                        <tr>
                                            <th className="text-left px-4 py-3">Type</th>
                                            <th className="text-left px-4 py-3">Property Numbers</th>
                                            <th className="text-left px-4 py-3">Article</th>
                                            <th className="text-left px-4 py-3">End User</th>
                                            <th className="text-left px-4 py-3">Condition</th>
                                            <th className="text-left px-4 py-3">Scans</th>
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
                                        ) : groupedScans.length === 0 ? (
                                            <tr>
                                                <td className="px-4 py-8 text-center text-slate-500" colSpan={7}>
                                                    No scanned assets yet for this cycle.
                                                </td>
                                            </tr>
                                        ) : (
                                            pagedGroupedScans.map((group) => {
                                                const scan = group.primaryScan;
                                                return (
                                                    <tr key={`${group.key}`} className="hover:bg-slate-50">
                                                        <td className="px-4 py-3 font-medium">{scan.rpc_type}</td>
                                                        <td className="px-4 py-3 font-semibold text-slate-800">
                                                            <div
                                                                className="flex items-center gap-2 cursor-pointer"
                                                                onClick={() => {
                                                                    setExpandedPropertyGroups((prev) => {
                                                                        const next = new Set(prev);
                                                                        if (next.has(group.key)) {
                                                                            next.delete(group.key);
                                                                        } else {
                                                                            next.add(group.key);
                                                                        }
                                                                        return next;
                                                                    });
                                                                }}
                                                                role="button"
                                                                tabIndex={0}
                                                            >
                                                                <span>
                                                                    {expandedPropertyGroups.has(group.key)
                                                                        ? group.propertyNumbersFull.join(', ')
                                                                        : group.propertyNumbersPreview}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">{scan.article || scan.description || '-'}</td>
                                                        <td className="px-4 py-3">{normalizeAccountableOfficer(scan.accountable_officer) || '-'}</td>

                                                        <td className="px-4 py-3">{scan.condition?.ConditionName || '-'}</td>
                                                        <td className="px-4 py-3 text-center">
                                                            {group.scansCount > 1 ? (
                                                                <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                                                                    {group.scansCount}
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-700">1</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="inline-flex gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenEdit(group)}
                                                                    className="p-2 rounded-md border border-slate-200 hover:bg-slate-100"
                                                                    title="Edit"
                                                                >
                                                                    <Edit3 className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteGroup(group)}
                                                                    className="p-2 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50"
                                                                    title="Remove"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {groupedScans.length > SCANNED_ASSETS_PER_PAGE && (
                                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
                                    <div className="text-sm text-slate-600">
                                        Showing {((scansPage - 1) * SCANNED_ASSETS_PER_PAGE) + 1} to {Math.min(scansPage * SCANNED_ASSETS_PER_PAGE, groupedScans.length)} of {groupedScans.length} groups
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setScansPage((prev) => Math.max(1, prev - 1))}
                                            disabled={scansPage === 1}
                                            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm disabled:opacity-50"
                                        >
                                            Previous
                                        </button>
                                        <span className="text-sm text-slate-600">Page {scansPage} of {scannedAssetsLastPage}</span>
                                        <button
                                            type="button"
                                            onClick={() => setScansPage((prev) => Math.min(scannedAssetsLastPage, prev + 1))}
                                            disabled={scansPage === scannedAssetsLastPage}
                                            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm disabled:opacity-50"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {isAdmin && (
                            <div className="mt-6 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50/70">
                                    <div>
                                        <div className="font-semibold text-slate-900">Audit Trail</div>
                                        <div className="text-xs text-slate-500">Authenticated user actions, sync events, edits, and deletions for this cycle.</div>
                                    </div>
                                    <Button
                                        type="button"
                                        size="sm"
                                        className="w-auto"
                                        onClick={() => {
                                            setAuditPage(1);
                                            void loadAuditLogs();
                                        }}
                                        disabled={loadingAuditLogs}
                                    >
                                        {loadingAuditLogs ? 'Refreshing...' : 'Refresh'}
                                    </Button>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-100 text-slate-700">
                                            <tr>
                                                <th className="text-left px-4 py-3">Timestamp</th>
                                                <th className="text-left px-4 py-3">Action</th>
                                                <th className="text-left px-4 py-3">User</th>
                                                <th className="text-left px-4 py-3">Property #</th>
                                                <th className="text-left px-4 py-3">Source</th>
                                                <th className="text-left px-4 py-3">Details</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {loadingAuditLogs ? (
                                                <tr>
                                                    <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                                                        Loading audit trail...
                                                    </td>
                                                </tr>
                                            ) : auditLogs.length === 0 ? (
                                                <tr>
                                                    <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                                                        No audit entries yet for this cycle.
                                                    </td>
                                                </tr>
                                            ) : (
                                                auditLogs.map((log) => {
                                                    const actor = log.performed_by?.FullName || `User ${log.performed_by_user_id}`;
                                                    const propertyNumber = log.property_number || log.scan?.property_number || '-';
                                                    const summary = summarizeAuditLog(log);

                                                    return (
                                                        <tr
                                                            key={log.AuditID}
                                                            className="hover:bg-slate-50 cursor-pointer"
                                                            onClick={() => {
                                                                setSelectedAuditLog(log);
                                                                setExpandedAuditFields(new Set());
                                                            }}
                                                        >
                                                            <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                                                                {new Date(log.created_at).toLocaleString('en-US', {
                                                                    month: 'short',
                                                                    day: 'numeric',
                                                                    year: 'numeric',
                                                                    hour: 'numeric',
                                                                    minute: '2-digit',
                                                                })}
                                                            </td>
                                                            <td className="px-4 py-3 font-medium text-slate-900">{formatAuditActionLabel(log.action)}</td>
                                                            <td className="px-4 py-3 text-slate-700">{actor}</td>
                                                            <td className="px-4 py-3 text-slate-700">{propertyNumber}</td>
                                                            <td className="px-4 py-3 text-slate-700">{formatAuditFieldValue('source', log.source ?? log.details?.source) || '-'}</td>
                                                            <td className="px-4 py-3 text-slate-600 text-sm leading-5">
                                                                <span className="block max-w-[520px] truncate" title={summary}>
                                                                    {summary}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {auditTotal > 20 && (
                                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
                                        <div className="text-sm text-slate-600">
                                            Showing {((auditPage - 1) * 20) + 1} to {Math.min(auditPage * 20, auditTotal)} of {auditTotal} audit entries
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setAuditPage((prev) => Math.max(1, prev - 1))}
                                                disabled={auditPage === 1 || loadingAuditLogs}
                                                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm disabled:opacity-50"
                                            >
                                                Previous
                                            </button>
                                            <span className="text-sm text-slate-600">Page {auditPage} of {auditLastPage}</span>
                                            <button
                                                type="button"
                                                onClick={() => setAuditPage((prev) => Math.min(auditLastPage, prev + 1))}
                                                disabled={auditPage === auditLastPage || loadingAuditLogs}
                                                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm disabled:opacity-50"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <Dialog
                            title={selectedAuditLog ? formatAuditActionLabel(selectedAuditLog.action) : 'Audit details'}
                            description={selectedAuditLog ? new Date(selectedAuditLog.created_at).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                            }) : undefined}
                            open={Boolean(selectedAuditLog)}
                            onOpenChange={(open) => {
                                if (!open) {
                                    setSelectedAuditLog(null);
                                }
                            }}
                            onConfirm={() => setSelectedAuditLog(null)}
                            confirmText="Close"
                            hideConfirm
                            contentClassName="max-w-2xl"
                        >
                            {selectedAuditLog && (
                                <div className="space-y-3 text-sm">
                                    <div className="grid grid-cols-1 gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
                                        <div>
                                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">User</div>
                                            <div className="text-slate-900">{selectedAuditLog.performed_by?.FullName || 'Unknown user'}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Property #</div>
                                            <div className="text-slate-900">{selectedAuditLog.property_number || selectedAuditLog.scan?.property_number || 'Not available'}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Source</div>
                                            <div className="text-slate-900">{formatAuditFieldValue('source', selectedAuditLog.source ?? selectedAuditLog.details?.source) || 'Not available'}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Action</div>
                                            <div className="text-slate-900">{formatAuditActionLabel(selectedAuditLog.action)}</div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {(() => {
                                            const allEntries = formatDetailEntries(selectedAuditLog);
                                            let entriesToShow = allEntries;

                                            if (selectedAuditLog.action === 'scan_deleted') {
                                                entriesToShow = allEntries.filter((e) => ['property_number'].includes(e.key));
                                            } else if (selectedAuditLog.action === 'scan_created') {
                                                entriesToShow = allEntries.filter((e) => !['before_condition_id', 'previous_condition_id', 'previous_remarks', 'new_remarks', 'scanned_at'].includes(e.key));
                                            }

                                            if (entriesToShow.length === 0) {
                                                return <div className="text-slate-500">No additional details.</div>;
                                            }

                                            return entriesToShow.map((entry) => {
                                                const fieldKey = `${selectedAuditLog.AuditID}:${entry.key}`;
                                                const expanded = expandedAuditFields.has(fieldKey);
                                                const longValue = entry.value.length > 120;
                                                return (
                                                    <button
                                                        key={fieldKey}
                                                        type="button"
                                                        onClick={() => {
                                                            setExpandedAuditFields((prev) => {
                                                                const next = new Set(prev);
                                                                if (next.has(fieldKey)) {
                                                                    next.delete(fieldKey);
                                                                } else {
                                                                    next.add(fieldKey);
                                                                }
                                                                return next;
                                                            });
                                                        }}
                                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left"
                                                    >
                                                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{entry.label}</div>
                                                        <div className={`text-slate-900 ${!expanded && longValue ? 'truncate' : ''}`}>
                                                            {expanded || !longValue ? entry.value : `${entry.value.slice(0, 117)}...`}
                                                        </div>
                                                    </button>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                            )}
                        </Dialog>
                    </>
                ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">
                        No cycle selected.
                    </div>
                )}

            </div>
        </div>
    );
}
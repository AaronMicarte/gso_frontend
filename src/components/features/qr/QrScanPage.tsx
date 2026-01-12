'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import type { IScannerControls } from '@zxing/browser';
import { Dialog } from '@/components/ui/Dialog';
import { useInventory } from '@/lib/hooks/useInventory';

type ScanMode = 'paste' | 'camera';

type ScanTarget =
    | { kind: 'property'; propertyId: number }
    | { kind: 'inventory'; inventoryId: number; inventoryDetailId: number | null }
    | null;

function parseScanTarget(raw: string): ScanTarget {
    const value = raw.trim();
    if (value === '') return null;

    const direct = Number(value);
    if (Number.isInteger(direct) && direct > 0) {
        return { kind: 'property', propertyId: direct };
    }

    const parsePath = (pathname: string, search = ''): ScanTarget => {
        const qs = new URLSearchParams(search);
        const detailParam = qs.get('detail');
        const parsedDetailId = detailParam ? Number(detailParam) : NaN;
        const inventoryDetailId = Number.isInteger(parsedDetailId) && parsedDetailId > 0 ? parsedDetailId : null;

        const qrMatch = pathname.match(/\/qr\/scan\/(\d+)/);
        if (qrMatch?.[1]) {
            const id = Number(qrMatch[1]);
            if (Number.isInteger(id) && id > 0) return { kind: 'property', propertyId: id };
        }

        const inventoryMatch = pathname.match(/\/(?:(admin|staff|department_head)\/)?inventory\/(\d+)/);
        if (inventoryMatch?.[2]) {
            const inventoryId = Number(inventoryMatch[2]);
            if (Number.isInteger(inventoryId) && inventoryId > 0) {
                return { kind: 'inventory', inventoryId, inventoryDetailId };
            }
        }

        return null;
    };

    try {
        const asUrl = new URL(value);
        return parsePath(asUrl.pathname, asUrl.search);
    } catch {
        // Not a URL
    }

    const routeLike = value.match(/^(\/[^\s?#]+)(\?[^\s#]+)?(#[^\s]+)?$/);
    if (routeLike?.[1]) {
        return parsePath(routeLike[1], routeLike[2] ?? '');
    }

    return null;
}

export function QrScanPage() {
    const router = useRouter();

    const [mode, setMode] = useState<ScanMode>('paste');
    const [input, setInput] = useState('');

    // Camera scanning state
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const controlsRef = useRef<IScannerControls | null>(null);
    const [cameraReady, setCameraReady] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [isStartingCamera, setIsStartingCamera] = useState(false);

    // Inventory QR modal state
    const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
    const [scannedInventoryId, setScannedInventoryId] = useState<number | null>(null);
    const [scannedInventoryDetailId, setScannedInventoryDetailId] = useState<number | null>(null);
    const [selectedInventoryDetailId, setSelectedInventoryDetailId] = useState<number | null>(null);

    const target = useMemo(() => parseScanTarget(input), [input]);

    const inventoryQuery = useInventory(scannedInventoryId ?? 0);

    const goToTarget = (scanTarget: Exclude<ScanTarget, null>) => {
        if (scanTarget.kind === 'property') {
            router.push(`/qr/scan/${scanTarget.propertyId}`);
            return;
        }

        // Inventory QRs MUST include a detail ID, otherwise the scan is ambiguous.
        // If you scanned something like /admin/inventory/{id} with multiple items, we refuse and ask to reprint.
        if (!scanTarget.inventoryDetailId) {
            toast.error('Invalid or old sticker QR', {
                description:
                    'This QR points to an inventory record (can contain multiple items). Print the sticker per-item so the QR URL includes ?detail={InventoryDetailID}.',
            });
            return;
        }

        setScannedInventoryId(scanTarget.inventoryId);
        setScannedInventoryDetailId(scanTarget.inventoryDetailId);
        setSelectedInventoryDetailId(scanTarget.inventoryDetailId);
        setInventoryModalOpen(true);
    };

    const go = () => {
        if (!target) {
            toast.error('Enter a valid PropertyID or supported QR URL');
            return;
        }
        goToTarget(target);
    };

    const startCamera = async () => {
        setCameraError(null);
        setIsStartingCamera(true);

        try {
            stopCamera();
            if (!videoRef.current) {
                throw new Error('Camera element not ready');
            }

            const { BrowserMultiFormatReader } = await import('@zxing/browser');
            const reader = new BrowserMultiFormatReader();

            const controls = await reader.decodeFromVideoDevice(
                undefined,
                videoRef.current,
                (result, err, controls) => {
                    if (result) {
                        const text = result.getText();
                        const parsed = parseScanTarget(text);
                        if (!parsed) {
                            toast.error('Unsupported QR', {
                                description: 'This QR does not match a PropertyID, /qr/scan/{id}, or /admin/inventory/{id}.',
                            });
                            return;
                        }

                        // Stop camera once we have a good scan
                        try {
                            controls.stop();
                        } finally {
                            controlsRef.current = null;
                            setCameraReady(false);
                        }
                        setCameraReady(false);
                        goToTarget(parsed);
                        return;
                    }

                    // Ignore decode errors (normal while scanning)
                    void err;
                }
            );

            controlsRef.current = controls;
            setCameraReady(true);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unable to start camera';
            setCameraError(message);
            toast.error('Camera Error', { description: message });
        } finally {
            setIsStartingCamera(false);
        }
    };

    const stopCamera = () => {
        try {
            controlsRef.current?.stop();
        } catch {
            // ignore
        } finally {
            controlsRef.current = null;
            const video = videoRef.current;
            const stream = (video?.srcObject as MediaStream | null) ?? null;
            if (stream) {
                for (const track of stream.getTracks()) {
                    track.stop();
                }
            }
            if (video) {
                video.srcObject = null;
            }
            setCameraReady(false);
        }
    };

    useEffect(() => {
        // Auto-start/stop when mode switches
        if (mode === 'camera') {
            void startCamera();
        } else {
            stopCamera();
        }

        return () => {
            stopCamera();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode]);

    return (
        <div className="p-6 space-y-6">
            <Dialog
                open={inventoryModalOpen}
                onOpenChange={(open) => {
                    setInventoryModalOpen(open);
                    if (!open) {
                        setScannedInventoryId(null);
                        setScannedInventoryDetailId(null);
                        setSelectedInventoryDetailId(null);
                    }
                }}
                title="Scanned Property Sticker"
                description="Preview of the scanned inventory QR."
                confirmText="View Full Record"
                cancelText="Close"
                loading={inventoryQuery.isLoading}
                onConfirm={() => {
                    if (!scannedInventoryId) return;
                    router.push(`/admin/inventory/${scannedInventoryId}`);
                }}
                contentClassName="max-w-2xl"
            >
                {inventoryQuery.isLoading ? (
                    <div className="text-sm text-slate-600">Loading inventory details…</div>
                ) : inventoryQuery.isError ? (
                    <div className="text-sm text-red-600">Failed to load inventory details.</div>
                ) : inventoryQuery.data ? (
                    <div className="space-y-6">
                        {/* Details Grid */}
                        {(() => {
                            const details = inventoryQuery.data.details ?? [];
                            const assigned = details.filter((d) => d.PropertyStatusID === 2);
                            const candidates = assigned.length > 0 ? assigned : details;

                            const effectiveDetailId = selectedInventoryDetailId ?? scannedInventoryDetailId;
                            const selected = effectiveDetailId
                                ? candidates.find((d) => d.InventoryDetailID === effectiveDetailId) ?? null
                                : candidates.length === 1
                                    ? candidates[0]
                                    : null;

                            if (!selected) {
                                return (
                                    <div className="text-sm text-slate-600">
                                        No item details found for this sticker. Please re-scan or reprint the sticker.
                                    </div>
                                );
                            }

                            const endUserName = selected.custodianName || 'Unassigned';
                            const itemName = selected.dr_item_description || selected.PropertyName || 'Unknown Item';
                            const department = selected.locationDepartment || 'GSO Property Custodian';
                            const category = (selected as any).propertyType?.PropertyName || selected.PropertyName || '-';
                            const propertyNo = selected.PropertyNumber || '—';
                            const unitCost = selected.UnitCost != null ? `₱${Number(selected.UnitCost).toLocaleString()}` : '-';
                            const brand = selected.Brand || '-';
                            const model = selected.ModelNumber || '-';
                            const serial = selected.SerialNumber || '-';

                            const fmtDate = (raw?: string | null): string => {
                                if (!raw) return '-';
                                const date = new Date(raw);
                                if (Number.isNaN(date.getTime())) return '-';
                                return new Intl.DateTimeFormat('en-PH', {
                                    timeZone: 'Asia/Manila',
                                    year: 'numeric',
                                    month: 'short',
                                    day: '2-digit',
                                }).format(date);
                            };

                            const dateAcquired = fmtDate(inventoryQuery.data.DateAcquired);

                            return (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                        <div className="text-sm font-medium text-slate-700">Item</div>
                                        <div className="text-lg text-slate-900 break-words">{itemName}</div>
                                    </div>
                                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                        <div className="text-sm font-medium text-slate-700">Property No.</div>
                                        <div className="text-lg text-slate-900 break-words">{propertyNo}</div>
                                    </div>
                                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                        <div className="text-sm font-medium text-slate-700">End User</div>
                                        <div className="text-lg text-slate-900 break-words">{endUserName}</div>
                                    </div>
                                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                        <div className="text-sm font-medium text-slate-700">Department</div>
                                        <div className="text-lg text-slate-900 break-words">{department}</div>
                                    </div>
                                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                        <div className="text-sm font-medium text-slate-700">Classification</div>
                                        <div className="text-lg text-slate-900 break-words">{category}</div>
                                    </div>
                                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                        <div className="text-sm font-medium text-slate-700">Date Acquired</div>
                                        <div className="text-lg text-slate-900 break-words">{dateAcquired}</div>
                                    </div>
                                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                        <div className="text-sm font-medium text-slate-700">Unit Cost</div>
                                        <div className="text-lg text-slate-900 break-words">{unitCost}</div>
                                    </div>
                                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                        <div className="text-sm font-medium text-slate-700">Brand / Model / Serial</div>
                                        <div className="text-lg text-slate-900 break-words">{brand} / {model} / {serial}</div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Actions */}
                        <div className="flex flex-wrap gap-3 justify-center">
                            <Button
                                type="button"
                                variant="primary"
                                onClick={() => {
                                    if (!scannedInventoryId) return;
                                    router.push(`/admin/inventory/${scannedInventoryId}`);
                                }}
                            >
                                View Full Record
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    if (!scannedInventoryId) return;
                                    if (!navigator.clipboard?.writeText) {
                                        toast.error('Copy not supported in this browser');
                                        return;
                                    }
                                    void navigator.clipboard.writeText(String(scannedInventoryId)).then(
                                        () => toast.success('Copied Inventory ID'),
                                        () => toast.error('Failed to copy')
                                    );
                                }}
                            >
                                Copy Inventory ID
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setInventoryModalOpen(false);
                                    setScannedInventoryId(null);
                                    setScannedInventoryDetailId(null);
                                    setSelectedInventoryDetailId(null);
                                    // Restart camera if in camera mode
                                    if (mode === 'camera') {
                                        void startCamera();
                                    }
                                }}
                            >
                                Scan Another
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="text-sm text-slate-600">No inventory data found.</div>
                )}
            </Dialog>

            <div>
                <h1 className="text-2xl font-bold text-slate-900">Scan QR</h1>
                <p className="text-sm text-slate-600">Scan a property QR, or paste the URL / enter the PropertyID.</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-2 w-fit">
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setMode('paste')}
                        className={`px-3 py-2 text-sm rounded-lg transition-colors ${mode === 'paste'
                            ? 'bg-slate-900 text-white'
                            : 'bg-white text-slate-700 hover:bg-slate-100'
                            }`}
                    >
                        Paste URL / ID
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('camera')}
                        className={`px-3 py-2 text-sm rounded-lg transition-colors ${mode === 'camera'
                            ? 'bg-slate-900 text-white'
                            : 'bg-white text-slate-700 hover:bg-slate-100'
                            }`}
                    >
                        Camera Scan
                    </button>
                </div>
            </div>

            {mode === 'paste' ? (
                <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 max-w-2xl">
                    <label className="block text-sm font-medium text-slate-700">QR URL or PropertyID</label>
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="e.g. 123 or https://.../qr/scan/123?h=..."
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="text-xs text-slate-500">
                            Tip: You can paste the full QR URL or just the numeric PropertyID.
                        </div>
                        <Button onClick={go} className="w-auto" disabled={!target}>
                            {target?.kind === 'inventory' ? 'Preview Sticker QR' : 'View Property'}
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                            <div className="text-sm font-medium text-slate-900">Camera</div>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => {
                                        stopCamera();
                                        void startCamera();
                                    }}
                                    isLoading={isStartingCamera}
                                >
                                    Restart
                                </Button>
                                <Button size="sm" variant="outline" onClick={stopCamera}>
                                    Stop
                                </Button>
                            </div>
                        </div>

                        <div className="p-4">
                            <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-950">
                                <video
                                    ref={videoRef}
                                    className="w-full h-[480px] object-cover"
                                    muted
                                    playsInline
                                />
                            </div>

                            <div className="mt-3 text-sm">
                                {cameraError ? (
                                    <div className="text-red-600">{cameraError}</div>
                                ) : cameraReady ? (
                                    <div className="text-slate-700">Point the camera at the QR code to scan.</div>
                                ) : (
                                    <div className="text-slate-600">Starting camera…</div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 p-4 h-fit space-y-2">
                        <div className="font-semibold text-slate-900">Notes</div>
                        <div className="text-sm text-slate-600">
                            - Allow camera permission when prompted.
                            <br />- Best results with good lighting.
                            <br />- This scans QR codes that contain a GSO property URL like{' '}
                            <span className="font-mono">{'/qr/scan/{PropertyID}'}</span>.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { fetchQrProperties, generateQrForProperty } from '@/lib/api/qr';
import type { QrScanAssignedProperty } from '@/types/qr';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { QRCodeWithPrint } from '@/components/ui/QRCodeWithPrint';

function getDisplayName(property: QrScanAssignedProperty): string {
    const itemName = property.inventoryDetail?.drDetail?.ItemDescription;
    const fallback = property.Description;
    return itemName ?? fallback ?? 'Property';
}

export function QrGeneratePage() {
    const queryClient = useQueryClient();

    const [search, setSearch] = useState('');
    const [missingOnly, setMissingOnly] = useState(false);

    const [selected, setSelected] = useState<QrScanAssignedProperty | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    const params = useMemo(
        () => ({
            per_page: 20,
            search: search.trim() || undefined,
            missing_qr_only: missingOnly || undefined,
        }),
        [search, missingOnly]
    );

    const { data, isLoading, isError } = useQuery({
        queryKey: ['qr-properties', params],
        queryFn: () => fetchQrProperties(params),
    });

    const generateMutation = useMutation({
        mutationFn: async (propertyId: number) => generateQrForProperty(propertyId),
        onSuccess: async () => {
            toast.success('QR generated');
            await queryClient.invalidateQueries({ queryKey: ['qr-properties'] });
        },
        onError: (error: unknown) => {
            const message = error instanceof Error ? error.message : 'Failed to generate QR';
            toast.error(message);
        },
    });

    const rows = data?.data ?? [];

    const openDialog = (property: QrScanAssignedProperty) => {
        setSelected(property);
        setDialogOpen(true);
    };

    const selectedQrValue = useMemo(() => {
        if (!selected) return null;

        // IMPORTANT: Do not trust stored QRCodeData blindly.
        // Older DB dumps may contain inventory-level URLs (ambiguous). A QR must identify exactly 1 property.
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        return `${origin}/qr/scan/${selected.PropertyID}`;
    }, [selected]);

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold text-slate-900">Generate QR Codes</h1>
                <p className="text-sm text-slate-600">QR codes are generated for issued/assigned properties (accountability records).</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col md:flex-row md:items-center gap-3">
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search property no., serial, end user…"
                    className="w-full md:flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm"
                />
                <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                        type="checkbox"
                        checked={missingOnly}
                        onChange={(e) => setMissingOnly(e.target.checked)}
                        className="h-4 w-4"
                    />
                    Missing QR only
                </label>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <div className="text-sm text-slate-700">{isLoading ? 'Loading…' : `Showing ${rows.length} of ${data?.total ?? 0}`}</div>
                </div>

                {isError && <div className="p-4 text-sm text-red-600">Failed to load QR properties.</div>}

                {!isLoading && rows.length === 0 && <div className="p-6 text-sm text-slate-600">No assigned properties found.</div>}

                <div className="divide-y divide-slate-100">
                    {rows.map((p) => {
                        const hasQr = Boolean(p.qrCode?.QRCodeData);
                        const endUserName = p.endUser?.FullName ?? 'N/A';
                        const deptName = p.department?.DepartmentName ?? p.endUser?.department?.DepartmentName ?? 'N/A';
                        const propertyNo = p.inventoryDetail?.PropertyNumber ?? '—';

                        return (
                            <div key={p.PropertyID} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-slate-900 truncate">{getDisplayName(p)}</div>
                                    <div className="text-xs text-slate-600 mt-1">Property No: {propertyNo} · Assigned to: {endUserName} · Dept: {deptName}</div>
                                </div>
                                <div className="flex gap-2 md:justify-end">
                                    <Button
                                        size="sm"
                                        variant={hasQr ? 'secondary' : 'primary'}
                                        className="w-auto"
                                        onClick={() => {
                                            if (hasQr) {
                                                openDialog(p);
                                                return;
                                            }
                                            generateMutation.mutate(p.PropertyID);
                                        }}
                                        isLoading={generateMutation.isPending && generateMutation.variables === p.PropertyID}
                                    >
                                        {hasQr ? 'View / Print' : 'Generate'}
                                    </Button>
                                    {hasQr && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="w-auto"
                                            onClick={() => generateMutation.mutate(p.PropertyID)}
                                            isLoading={generateMutation.isPending && generateMutation.variables === p.PropertyID}
                                        >
                                            Regenerate
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <Dialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                title={selected ? `QR: ${getDisplayName(selected)}` : 'QR Code'}
                description={selected?.inventoryDetail?.PropertyNumber ? `Property No: ${selected.inventoryDetail.PropertyNumber}` : undefined}
                confirmText="Regenerate"
                cancelText="Close"
                loading={generateMutation.isPending}
                onConfirm={() => {
                    if (!selected) return;
                    generateMutation.mutate(selected.PropertyID);
                }}
            >
                <div className="space-y-4">
                    {!selectedQrValue ? (
                        <div className="text-sm text-slate-600">No QR code generated yet.</div>
                    ) : (
                        <QRCodeWithPrint value={selectedQrValue} title="GSO Property QR" />
                    )}
                </div>
            </Dialog>
        </div>
    );
}

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Printer, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { getIAR, updateIAR, uploadIARSignature } from '@/lib/api/iar';
import { useAuth } from '@/lib/hooks/useAuth';
import { resolveStorageUrl, resolveSignatureUrl } from '@/lib/utils/signature';
import { IAR } from '@/types/iar';
import { toast } from 'sonner';

import { IARPrintView } from './IARPrintView';
import { Dialog } from '@/components/ui/Dialog';
import { SignatureModal } from '@/components/ui/SignatureModal';
import * as DialogPrimitive from "@radix-ui/react-dialog";
import React from 'react';

function InspectedSignatureViewer({ url, fallbackUrl }: { url: string; fallbackUrl?: string }) {
    const [src, setSrc] = React.useState(url);
    const [attempt, setAttempt] = React.useState(0); // 0 = first try, 1 = fallback try, 2 = failed

    return (
        <>
            <DialogPrimitive.Description className="sr-only">Signature preview</DialogPrimitive.Description>
            <div className="flex justify-center">
                {attempt < 2 ? (
                    <img
                        src={src}
                        alt="Inspected signature"
                        width={400}
                        height={120}
                        className="object-contain border rounded"
                        onError={() => {
                            if (attempt === 0 && fallbackUrl) {
                                // try fallback streaming URL
                                setSrc(fallbackUrl);
                                setAttempt(1);
                            } else {
                                setAttempt(2);
                            }
                        }}
                    />
                ) : (
                    <div className="w-full max-w-md border rounded p-4 text-center">
                        <p className="text-slate-700">Signature could not be loaded.</p>
                        <a href={src} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-[var(--primary)] underline">Open / download signature</a>
                    </div>
                )}
            </div>
        </>
    );
}

interface ViewIARPageProps {
    baseRoute: string;
}

export function ViewIARPage({ baseRoute }: ViewIARPageProps) {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const [iar, setIar] = useState<IAR | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAccepting, setIsAccepting] = useState(false);
    const [isAcceptDialogOpen, setIsAcceptDialogOpen] = useState(false);
    const [isAcceptSignatureModalOpen, setIsAcceptSignatureModalOpen] = useState(false); const [isAcceptedSignatureModalOpen, setIsAcceptedSignatureModalOpen] = useState(false); const [acceptSignature, setAcceptSignature] = useState<string | null>(null);
    const [acceptSignatureSource, setAcceptSignatureSource] = useState<'canvas' | 'upload' | null>(null);
    const [isInspectedSignatureModalOpen, setIsInspectedSignatureModalOpen] = useState(false);

    // Local state to hold inline verification edits per detail
    const [verifiedEdits, setVerifiedEdits] = useState<Record<number, { verified_brand?: string; verified_model?: string; verified_serial?: string }>>({});
    const [isSavingVerifications, setIsSavingVerifications] = useState(false);

    // Property types that require brand/model/serial verification
    const propertyTypesRequiringVerification = [3, 4, 5]; // IT Equipment, Machinery, Medical Equipment

    // Use shared helpers to resolve signatures & storage URLs
    const inspectedSignatureUrl = iar ? resolveSignatureUrl(iar, 'inspected') : null;
    const acceptedSignatureUrl = iar ? resolveSignatureUrl(iar, 'accepted') : null;

    const finalizeAccept = async (signature?: string | null, source?: 'canvas' | 'upload' | null) => {
        if (!iar) return;
        if (!signature) {
            toast.error('Acceptance signature is required. Please add a signature to proceed.');
            return;
        }

        // Validate required verified fields for certain property types
        const propertyTypesRequiringVerification = [3, 4, 5]; // IT Equipment, Machinery, Medical Equipment
        const missingVerifications: string[] = [];

        iar.details?.forEach((detail, index) => {
            if (propertyTypesRequiringVerification.includes(detail.PropertyTypeID)) {
                const verified = verifiedEdits[detail.IARDetailID || 0] || {};
                const currentBrand = verified.verified_brand ?? detail.VerifiedBrand ?? '';
                const currentModel = verified.verified_model ?? detail.VerifiedModel ?? '';
                const currentSerial = verified.verified_serial ?? detail.VerifiedSerial ?? '';

                if (!currentBrand.trim() || !currentModel.trim() || !currentSerial.trim()) {
                    missingVerifications.push(`${detail.drDetail?.ItemDescription || `Item ${index + 1}`}`);
                }
            }
        });

        if (missingVerifications.length > 0) {
            toast.error(`Brand, Model, and Serial are required for: ${missingVerifications.join(', ')}. Please fill in the verified values before accepting.`);
            return;
        }

        try {
            setIsAccepting(true);
            const todayManila = formatInTimeZone(new Date(), 'Asia/Manila', 'yyyy-MM-dd');
            const dateInspectedFormatted = formatInTimeZone(
                toZonedTime(new Date(iar.DateInspected), 'Asia/Manila'),
                'Asia/Manila',
                'yyyy-MM-dd'
            );

            // Upload the accepted signature first so the server sees an accepted signature
            // when we update the IAR to set AcceptedBy (the update endpoint requires an
            // accepted signature to already exist when AcceptedBy is set).
            await uploadIARSignature(iar.IARID, 'accepted', signature, source || undefined);

            // Then update IAR to set accepted_by/date_accepted and details
            await updateIAR(iar.IARID, {
                inspected_by: iar.InspectedBy,
                accepted_by: user?.UserID || 0,
                date_inspected: dateInspectedFormatted,
                date_accepted: todayManila,
                remarks: iar.Remarks || '',
                details: iar.details?.map(d => ({
                    dr_detail_id: d.DRDetailID,
                    property_type_id: d.PropertyTypeID,
                    condition_id: d.ConditionID,
                    quantity_accepted: d.QuantityAccepted,
                    quantity_rejected: d.QuantityRejected,
                    verified_brand: verifiedEdits[d.IARDetailID || 0]?.verified_brand ?? d.VerifiedBrand ?? null,
                    verified_model: verifiedEdits[d.IARDetailID || 0]?.verified_model ?? d.VerifiedModel ?? null,
                    verified_serial: verifiedEdits[d.IARDetailID || 0]?.verified_serial ?? d.VerifiedSerial ?? null,
                    remarks: d.Remarks || '',
                })) || [],
            });

            toast.success('IAR accepted successfully');
            setIsAcceptDialogOpen(false);
            const updated = await getIAR(iar.IARID);
            setIar(updated);
            // Open the accepted signature viewer so the user can confirm the saved signature
            setIsAcceptedSignatureModalOpen(true);
        } catch (err: unknown) {
            let message = 'Failed to accept IAR';
            if (typeof err === 'object' && err !== null && 'message' in err) {
                const msg = (err as { message?: unknown }).message;
                if (typeof msg === 'string') message = msg;
            }
            toast.error(message);
        } finally {
            setIsAccepting(false);
        }
    };

    const handleConfirmAccept = async () => {
        if (!iar) return;
        // If user wants to add a signature, show modal first
        if (!acceptSignature) {
            setIsAcceptDialogOpen(false);
            setIsAcceptSignatureModalOpen(true);
            return;
        }
        await finalizeAccept(acceptSignature, acceptSignatureSource);
    };

    useEffect(() => {
        const fetchIAR = async () => {
            try {
                const id = params.id as string;
                if (!id) return;
                const data = await getIAR(parseInt(id));
                setIar(data);
            } catch (error: unknown) {
                console.error(error);
                let message = 'Failed to load IAR';
                if (typeof error === 'object' && error !== null && 'message' in error) {
                    const msg = (error as { message?: unknown }).message;
                    if (typeof msg === 'string') message = msg;
                }
                if (message.includes('Access denied') || message.includes('denied')) {
                    toast.error('Access denied: You can only view IARs where you are the inspector or acceptor');
                } else {
                    toast.error(message);
                }
                router.push(`${baseRoute}/inspection-acceptance-reports`);
            } finally {
                setIsLoading(false);
            }
        };

        fetchIAR();
    }, [params.id, baseRoute, router]);

    // Initialize verified edits when the IAR loads
    useEffect(() => {
        if (!iar) return;
        const map: Record<number, { verified_brand?: string; verified_model?: string; verified_serial?: string }> = {};
        (iar.details || []).forEach(d => {
            if (d.IARDetailID) {
                map[d.IARDetailID] = {
                    verified_brand: d.VerifiedBrand || '',
                    verified_model: d.VerifiedModel || '',
                    verified_serial: d.VerifiedSerial || ''
                };
            }
        });
        setVerifiedEdits(map);
    }, [iar]);

    const canEditVerifications = !!iar && !!user && (user.UserRoleID === 1 || user.UserRoleID === 2) && !iar.DateAccepted;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
            </div>
        );
    }

    if (!iar) return null;

    return (
        <>
            <div className="p-6 space-y-6 print:hidden">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href={`${baseRoute}/inspection-acceptance-reports`}
                            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                        >
                            <ArrowLeft className="w-6 h-6 text-slate-600" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">IAR Details</h1>
                            <p className="text-slate-500 text-sm">{iar.IARNumber}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {!iar.AcceptedBy && (user?.UserRoleID === 1 || user?.UserRoleID === 2) && (
                            <>
                                <button
                                    onClick={() => setIsAcceptDialogOpen(true)}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 transition-colors font-medium"
                                    disabled={isAccepting}
                                >
                                    {isAccepting ? 'Accepting...' : 'Accept'}
                                </button>

                                <Dialog
                                    title="Confirm Acceptance"
                                    description="Mark this IAR as accepted by you? This action will set the IAR as accepted and record the date. You MUST provide an acceptance signature to complete acceptance."
                                    open={isAcceptDialogOpen}
                                    onOpenChange={setIsAcceptDialogOpen}
                                    onConfirm={handleConfirmAccept}
                                    confirmText="Accept"
                                    cancelText="Cancel"
                                    loading={isAccepting}
                                />

                                <SignatureModal
                                    open={isAcceptSignatureModalOpen}
                                    onOpenChange={(open) => {
                                        setIsAcceptSignatureModalOpen(open);
                                        if (!open && !acceptSignature) {
                                            // User closed without adding signature -> cancel acceptance
                                            toast.error('Acceptance cancelled: signature required.');
                                            // reset any temporary signature state
                                            setAcceptSignature(null);
                                            setAcceptSignatureSource(null);
                                        }
                                    }}
                                    onSave={(dataUrl, source) => {
                                        setAcceptSignature(dataUrl);
                                        setAcceptSignatureSource(source);
                                        setIsAcceptSignatureModalOpen(false);
                                        // proceed to accept with signature
                                        finalizeAccept(dataUrl, source);
                                    }}
                                />


                            </>
                        )}
                        <button
                            onClick={async () => {
                                // Prepare signatures for print by fetching and embedding non-data URLs as data URLs
                                try {
                                    const preparePrint = async () => {
                                        if (!iar) return;

                                        const inspectedSig = inspectedSignatureUrl && !inspectedSignatureUrl.startsWith('data:')
                                            ? `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/signatures/${iar.IARID}/inspected`
                                            : inspectedSignatureUrl || null;

                                        const acceptedSig = acceptedSignatureUrl && !acceptedSignatureUrl.startsWith('data:')
                                            ? `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/signatures/${iar.IARID}/accepted`
                                            : acceptedSignatureUrl || null;

                                        const fetchToDataUrl = async (url?: string | null) => {
                                            if (!url) return null;
                                            if (url.startsWith('data:')) return url;
                                            try {
                                                const resp = await fetch(url, { mode: 'cors' });
                                                if (!resp.ok) return null;
                                                const blob = await resp.blob();
                                                return await new Promise<string | null>((res) => {
                                                    const reader = new FileReader();
                                                    reader.onloadend = () => res(typeof reader.result === 'string' ? reader.result : null);
                                                    reader.onerror = () => res(null);
                                                    reader.readAsDataURL(blob);
                                                });
                                            } catch (e) {
                                                return null;
                                            }
                                        };

                                        const [insData, accData] = await Promise.all([
                                            fetchToDataUrl(inspectedSig),
                                            fetchToDataUrl(acceptedSig),
                                        ]);

                                        // Update print signatures in IARPrintView via custom event so we don't need to refactor prop drilling
                                        const detail = { inspected: insData, accepted: accData };
                                        window.dispatchEvent(new CustomEvent('gso:print-signatures', { detail }));

                                        // Wait for a short moment to allow images to update, then print
                                        setTimeout(() => window.print(), 300);
                                    };

                                    await preparePrint();
                                } catch (err) {
                                    // fallback to normal print
                                    window.print();
                                }
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            <Printer className="w-4 h-4" />
                            Print
                        </button>

                        {/* Inspected Signature View Modal (always mounted) */}
                        <DialogPrimitive.Root open={isInspectedSignatureModalOpen} onOpenChange={setIsInspectedSignatureModalOpen}>
                            <DialogPrimitive.Portal>
                                <DialogPrimitive.Overlay className="fixed inset-0 bg-black/30 z-40" />
                                <DialogPrimitive.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
                                    <DialogPrimitive.Title className="text-lg font-bold text-slate-900">Inspected Signature</DialogPrimitive.Title>
                                    {inspectedSignatureUrl ? (
                                        <InspectedSignatureViewer
                                            url={resolveStorageUrl(inspectedSignatureUrl)}
                                            fallbackUrl={`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/signatures/${iar.IARID}/inspected`}
                                        />
                                    ) : (
                                        <div className="w-full max-w-md border rounded p-4 text-center">
                                            <p className="text-slate-700">No inspected signature available.</p>
                                        </div>
                                    )}
                                    <div className="flex justify-end pt-4">
                                        <DialogPrimitive.Close asChild>
                                            <button className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90 transition-colors font-medium text-sm">
                                                Close
                                            </button>
                                        </DialogPrimitive.Close>
                                    </div>
                                </DialogPrimitive.Content>
                            </DialogPrimitive.Portal>
                        </DialogPrimitive.Root>

                        {/* Accepted Signature View Modal (always mounted) */}
                        <DialogPrimitive.Root open={isAcceptedSignatureModalOpen} onOpenChange={setIsAcceptedSignatureModalOpen}>
                            <DialogPrimitive.Portal>
                                <DialogPrimitive.Overlay className="fixed inset-0 bg-black/30 z-40" />
                                <DialogPrimitive.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
                                    <DialogPrimitive.Title className="text-lg font-bold text-slate-900">Accepted Signature</DialogPrimitive.Title>
                                    {acceptedSignatureUrl ? (
                                        <InspectedSignatureViewer
                                            url={resolveStorageUrl(acceptedSignatureUrl)}
                                            fallbackUrl={`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/signatures/${iar.IARID}/accepted`}
                                        />
                                    ) : (
                                        <div className="w-full max-w-md border rounded p-4 text-center">
                                            <p className="text-slate-700">No accepted signature available.</p>
                                        </div>
                                    )}
                                    <div className="flex justify-end pt-4">
                                        <DialogPrimitive.Close asChild>
                                            <button className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90 transition-colors font-medium text-sm">
                                                Close
                                            </button>
                                        </DialogPrimitive.Close>
                                    </div>
                                </DialogPrimitive.Content>
                            </DialogPrimitive.Portal>
                        </DialogPrimitive.Root>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">General Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">IAR Number</label>
                            <p className="mt-1 text-slate-900">{iar.IARNumber}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">DR Number</label>
                            <p className="mt-1 text-slate-900">{iar.deliveryReceipt?.DRNumber}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Date Inspected</label>
                            <p className="mt-1 text-slate-900">
                                {format(toZonedTime(new Date(iar.DateInspected), 'Asia/Manila'), 'PPP')}
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Date Accepted</label>
                            <p className="mt-1 text-slate-900">{iar.DateAccepted ? format(toZonedTime(new Date(iar.DateAccepted), 'Asia/Manila'), 'PPP') : 'Pending'}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Inspected By</label>
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-slate-900">{iar.inspectedByUser?.FullName || 'Pending'}</p>
                                {inspectedSignatureUrl && (
                                    <button
                                        type="button"
                                        onClick={() => setIsInspectedSignatureModalOpen(true)}
                                        className="p-1 hover:bg-slate-100 rounded transition-colors relative z-30 focus:outline-none"
                                        title="View signature"
                                        aria-label="View inspected signature"
                                    >
                                        <Eye className="w-4 h-4 text-slate-500" />
                                    </button>
                                )}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Accepted By</label>
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-slate-900">{iar.acceptedByUser?.FullName || 'Pending'}</p>
                                {acceptedSignatureUrl && (
                                    <button
                                        type="button"
                                        onClick={() => setIsAcceptedSignatureModalOpen(true)}
                                        className="p-1 hover:bg-slate-100 rounded transition-colors relative z-30 focus:outline-none"
                                        title="View signature"
                                        aria-label="View accepted signature"
                                    >
                                        <Eye className="w-4 h-4 text-slate-500" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-slate-900">Inspection Details</h2>
                        {canEditVerifications && (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (!iar) return;

                                        // Validate required verified fields for certain property types
                                        const missingVerifications: string[] = [];
                                        iar.details?.forEach((detail, index) => {
                                            if (propertyTypesRequiringVerification.includes(detail.PropertyTypeID)) {
                                                const verified = verifiedEdits[detail.IARDetailID || 0] || {};
                                                const currentBrand = verified.verified_brand ?? detail.VerifiedBrand ?? '';
                                                const currentModel = verified.verified_model ?? detail.VerifiedModel ?? '';
                                                const currentSerial = verified.verified_serial ?? detail.VerifiedSerial ?? '';

                                                if (!currentBrand.trim() || !currentModel.trim() || !currentSerial.trim()) {
                                                    missingVerifications.push(`${detail.drDetail?.ItemDescription || `Item ${index + 1}`}`);
                                                }
                                            }
                                        });

                                        if (missingVerifications.length > 0) {
                                            toast.error(`Brand, Model, and Serial are required for: ${missingVerifications.join(', ')}. Please fill in all required fields.`);
                                            return;
                                        }

                                        setIsSavingVerifications(true);
                                        try {
                                            const dateInspectedStr = formatInTimeZone(toZonedTime(new Date(iar.DateInspected), 'Asia/Manila'), 'Asia/Manila', 'yyyy-MM-dd');
                                            const dateAcceptedStr = iar.DateAccepted ? formatInTimeZone(toZonedTime(new Date(iar.DateAccepted), 'Asia/Manila'), 'Asia/Manila', 'yyyy-MM-dd') : undefined;

                                            const payload = {
                                                inspected_by: iar.InspectedBy,
                                                accepted_by: iar.AcceptedBy ?? null,
                                                date_inspected: dateInspectedStr,
                                                date_accepted: dateAcceptedStr,
                                                remarks: iar.Remarks ?? undefined,
                                                details: (iar.details || []).map(d => ({
                                                    dr_detail_id: d.DRDetailID,
                                                    property_type_id: d.PropertyTypeID,
                                                    condition_id: d.ConditionID,
                                                    quantity_accepted: d.QuantityAccepted,
                                                    quantity_rejected: d.QuantityRejected,
                                                    verified_brand: verifiedEdits[d.IARDetailID || 0]?.verified_brand ?? d.VerifiedBrand ?? null,
                                                    verified_model: verifiedEdits[d.IARDetailID || 0]?.verified_model ?? d.VerifiedModel ?? null,
                                                    verified_serial: verifiedEdits[d.IARDetailID || 0]?.verified_serial ?? d.VerifiedSerial ?? null,
                                                    remarks: d.Remarks ?? undefined,
                                                }))
                                            };

                                            const updated = await updateIAR(iar.IARID, payload);
                                            setIar(updated);
                                            toast.success('Verified values saved');
                                        } catch (err: unknown) {
                                            console.error(err);
                                            // Show server-provided message if present (validation errors etc.)
                                            let message = 'Failed to save verified values';
                                            if (typeof err === 'object' && err !== null && 'response' in err) {
                                                // Try to read axios-style response
                                                // @ts-ignore
                                                const resp = (err as any).response;
                                                if (resp && resp.data) {
                                                    if (resp.data.message) message = String(resp.data.message);
                                                    else if (resp.data.errors) message = Object.values(resp.data.errors).flat().join(' ');
                                                }
                                            }
                                            toast.error(message);
                                        } finally {
                                            setIsSavingVerifications(false);
                                        }
                                    }}
                                    className="px-3 py-1.5 bg-[var(--primary)] text-white rounded-md text-sm hover:bg-[var(--primary)]/90 disabled:opacity-50"
                                    disabled={isSavingVerifications}
                                >
                                    {isSavingVerifications ? 'Saving...' : 'Save Verifications'}
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4">Item</th>
                                    <th className="px-6 py-4">Brand / Model / Serial</th>
                                    <th className="px-6 py-4">Condition</th>
                                    <th className="px-6 py-4 text-right">Accepted</th>
                                    <th className="px-6 py-4 text-right">Rejected</th>
                                    <th className="px-6 py-4">Remarks</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {iar.details?.map((detail) => (
                                    <tr key={detail.IARDetailID}>
                                        <td className="px-6 py-4 text-slate-900">
                                            {detail.drDetail?.ItemDescription}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            <div className="text-sm">
                                                {detail.drDetail && (
                                                    <div className="mb-2 p-2 bg-slate-50 rounded text-xs">
                                                        <div className="font-medium text-slate-700 mb-1">From DR:</div>
                                                        <div className="flex flex-wrap gap-4 text-sm">
                                                            {detail.drDetail.Brand && <div>Brand: <span className="font-medium">{detail.drDetail.Brand}</span></div>}
                                                            {detail.drDetail.ModelNumber && <div>Model: <span className="font-medium">{detail.drDetail.ModelNumber}</span></div>}
                                                            {detail.drDetail.SerialNumber && <div>Serial: <span className="font-medium">{detail.drDetail.SerialNumber}</span></div>}
                                                        </div>
                                                    </div>
                                                )}

                                                {propertyTypesRequiringVerification.includes(detail.PropertyTypeID) && canEditVerifications ? (
                                                    <div className="space-y-2">
                                                        <div className="font-medium text-slate-700 text-xs">Verified Values <span className="text-red-500">*</span>:</div>
                                                        <div className="flex gap-2">
                                                            <input
                                                                value={verifiedEdits[detail.IARDetailID || 0]?.verified_brand || ''}
                                                                onChange={(e) => setVerifiedEdits(prev => ({ ...prev, [detail.IARDetailID || 0]: { ...prev[detail.IARDetailID || 0], verified_brand: e.target.value } }))}
                                                                placeholder="Brand"
                                                                className={`px-2 py-1 border rounded text-sm w-1/3 ${propertyTypesRequiringVerification.includes(detail.PropertyTypeID) ? 'border-red-300 focus:border-red-500' : 'border-slate-200'}`}
                                                                required
                                                            />
                                                            <input
                                                                value={verifiedEdits[detail.IARDetailID || 0]?.verified_model || ''}
                                                                onChange={(e) => setVerifiedEdits(prev => ({ ...prev, [detail.IARDetailID || 0]: { ...prev[detail.IARDetailID || 0], verified_model: e.target.value } }))}
                                                                placeholder="Model"
                                                                className={`px-2 py-1 border rounded text-sm w-1/3 ${propertyTypesRequiringVerification.includes(detail.PropertyTypeID) ? 'border-red-300 focus:border-red-500' : 'border-slate-200'}`}
                                                                required
                                                            />
                                                            <input
                                                                value={verifiedEdits[detail.IARDetailID || 0]?.verified_serial || ''}
                                                                onChange={(e) => setVerifiedEdits(prev => ({ ...prev, [detail.IARDetailID || 0]: { ...prev[detail.IARDetailID || 0], verified_serial: e.target.value } }))}
                                                                placeholder="Serial"
                                                                className={`px-2 py-1 border rounded text-sm w-1/3 ${propertyTypesRequiringVerification.includes(detail.PropertyTypeID) ? 'border-red-300 focus:border-red-500' : 'border-slate-200'}`}
                                                                required
                                                            />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1">
                                                        <div className="font-medium text-slate-700 text-xs">Verified:</div>
                                                        <div className="text-sm text-slate-600">
                                                            {(detail.VerifiedBrand || detail.VerifiedModel || detail.VerifiedSerial) ? (
                                                                <>
                                                                    {detail.VerifiedBrand && <div>Brand: {detail.VerifiedBrand}</div>}
                                                                    {detail.VerifiedModel && <div>Model: {detail.VerifiedModel}</div>}
                                                                    {detail.VerifiedSerial && <div>Serial: {detail.VerifiedSerial}</div>}
                                                                </>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {detail.condition?.ConditionName}
                                        </td>
                                        <td className="px-6 py-4 text-right text-slate-900">
                                            {detail.QuantityAccepted}
                                        </td>
                                        <td className="px-6 py-4 text-right text-red-600">
                                            {detail.QuantityRejected}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {detail.Remarks || '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Print View */}
            <IARPrintView iar={iar} />
        </>
    );
}

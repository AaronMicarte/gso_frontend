'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { getIAR } from '@/lib/api/iar';
import { useAuth } from '@/lib/hooks/useAuth';
import { resolveSignatureUrl } from '@/lib/utils/signature';
import { IAR } from '@/types/iar';
import { toast } from 'sonner';

import { IARPrintView } from './IARPrintView';

interface ViewIARPageProps {
    baseRoute: string;
    iarId?: number;
    isModal?: boolean;
    onClose?: () => void;
}

export function ViewIARPage({ baseRoute, iarId, isModal = false, onClose }: ViewIARPageProps) {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const [iar, setIar] = useState<IAR | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const resolvedId = iarId ?? (params.id ? parseInt(params.id as string, 10) : null);

    // Use shared helpers to resolve signatures & storage URLs
    const inspectedSignatureUrl = iar ? resolveSignatureUrl(iar, 'inspected') : null;
    const acceptedSignatureUrl = iar ? resolveSignatureUrl(iar, 'accepted') : null;

    useEffect(() => {
        const fetchIAR = async () => {
            try {
                if (!resolvedId) return;
                const data = await getIAR(resolvedId);
                setIar(data);
            } catch (error: unknown) {
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
                if (isModal) {
                    onClose?.();
                } else {
                    router.push(`${baseRoute}/inspection-acceptance-reports`);
                }
            } finally {
                setIsLoading(false);
            }
        };

        if (resolvedId) {
            fetchIAR();
        }
    }, [resolvedId, baseRoute, router, isModal, onClose]);

    const canPrint = !!user && (user.UserRoleID === 1 || user.UserRoleID === 2);

    if (isLoading) {
        return (
            <div className={`flex items-center justify-center ${isModal ? 'py-10' : 'min-h-screen'} print:hidden`} style={isModal ? undefined : { backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundAttachment: 'fixed' }}>
                <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
            </div>
        );
    }

    if (!iar) {
        return (
            <div className={`flex items-center justify-center ${isModal ? 'py-10' : 'min-h-screen'} print:hidden`} style={isModal ? undefined : { backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundAttachment: 'fixed' }}>
                <div className="text-center space-y-3">
                    <p className="text-slate-600">IAR not found</p>
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
                            href={`${baseRoute}/inspection-acceptance-reports`}
                            className="text-[var(--primary)] hover:underline"
                        >
                            Back to list
                        </Link>
                    )}
                </div>
            </div>
        );
    }

    return (
        <>
            <div className={`${isModal ? '' : 'min-h-screen bg-cover bg-center bg-no-repeat'} print:hidden`} style={isModal ? undefined : { backgroundImage: "url('/assets/images/background/bg.jpg')" }}>
                <div className="p-6 space-y-6 print:hidden">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            {isModal ? (
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                                >
                                    <ArrowLeft className="w-6 h-6 text-slate-600" />
                                </button>
                            ) : (
                                <Link
                                    href={`${baseRoute}/inspection-acceptance-reports`}
                                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                                >
                                    <ArrowLeft className="w-6 h-6 text-slate-600" />
                                </Link>
                            )}
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">IAR Details</h1>
                                <p className="text-slate-500 text-sm">{iar.IARNumber}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {canPrint && (
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
                            )}

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
                                <p className="mt-1 text-slate-900">{iar.inspectedByUser?.FullName || 'Pending'}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Accepted By</label>
                                <p className="mt-1 text-slate-900">{iar.acceptedByUser?.FullName || 'Pending'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-900">Inspection Details</h2>
                            <span className="text-xs text-slate-500">Verified values are read-only.</span>
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

                                                    <div className="space-y-1">
                                                        <div className="font-medium text-slate-700 text-xs">Verified:</div>
                                                        <div className="text-sm text-slate-600">
                                                            {(detail.VerifiedBrand || detail.VerifiedModel || detail.VerifiedSerial) ? (
                                                                <>
                                                                    {detail.VerifiedBrand && <div>Brand: {detail.VerifiedBrand}</div>}
                                                                    {detail.VerifiedModel && <div>Model: {detail.VerifiedModel}</div>}
                                                                    {detail.VerifiedSerial && <div>Serial: {detail.VerifiedSerial}</div>}
                                                                </>
                                                            ) : (
                                                                <div className="text-slate-400">Not provided</div>
                                                            )}
                                                        </div>
                                                    </div>
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
            </div>

            {/* Print View */}
            <IARPrintView iar={iar} />
        </>
    );
}

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, AlertCircle, QrCode, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

import { scanProperty } from '@/lib/api/qr';
import type { QrScanResponse, QrScanAssignedProperty } from '@/types/qr';
import { useQuery } from '@tanstack/react-query';

interface ViewPropertyOversightPageProps {
    baseRoute: string;
}

function text(value: string | null | undefined, fallback: string): string {
    const trimmed = (value ?? '').trim();
    return trimmed.length > 0 ? trimmed : fallback;
}

function formatPHDate(dateString: string | null | undefined): string {
    if (!dateString) return 'Not recorded';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return 'Not recorded';
    return format(toZonedTime(date, 'Asia/Manila'), 'MMM dd, yyyy');
}

function getRequesterName(p: QrScanAssignedProperty): string {
    // For ICS issuances, show the requester (who requested the asset).
    // For PAR issuances, show the end user (who is assigned the asset).
    if (p.documentType === 'ICS') {
        return text(p.requester, 'Requester not recorded');
    }
    return text(p.endUser?.FullName, 'End user not recorded');
}

export function ViewPropertyOversightPage({ baseRoute }: ViewPropertyOversightPageProps) {
    const params = useParams();
    const router = useRouter();

    // Accepts both /[id] and /[propertyId] dynamic segments, but prefers id
    const rawId = params.propertyId;
    const propertyId = typeof rawId === 'string' ? Number(rawId) : NaN;


    const query = useQuery<QrScanResponse>({
        queryKey: ['qr-scan', propertyId],
        enabled: Number.isFinite(propertyId),
        queryFn: () => scanProperty(propertyId),
    });

    useEffect(() => {
        if (!query.error) return;
        const message = query.error instanceof Error ? query.error.message : 'Failed to load property details';
        toast.error(message);
    }, [query.error]);

    if (!Number.isFinite(propertyId)) {
        return (
            <div
                className="flex items-center justify-center min-h-screen"
                style={{
                    backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    backgroundAttachment: 'fixed',
                }}
            >
                <div className="text-center space-y-3">
                    <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
                    <p className="text-slate-600">Invalid property ID</p>
                    <Link href={`${baseRoute}/properties`} className="text-[var(--primary)] hover:underline">
                        Back to list
                    </Link>
                </div>
            </div>
        );
    }

    if (query.isLoading) {
        return null;
    }

    const data = query.data;
    if (!data?.property) {
        return (
            <div
                className="flex items-center justify-center min-h-screen"
                style={{
                    backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    backgroundAttachment: 'fixed',
                }}
            >
                <div className="text-center space-y-3">
                    <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
                    <p className="text-slate-600">Property not found</p>
                    <Link href={`${baseRoute}/properties`} className="text-[var(--primary)] hover:underline">
                        Back to list
                    </Link>
                </div>
            </div>
        );
    }

    const p = data.property;

    const propertyCard = text(p.PropertyCardNumber, 'Not recorded');
    const itemName = text(p.inventoryDetail?.drDetail?.ItemDescription ?? p.Description, 'Item not recorded');
    const title = `${propertyCard} · ${itemName}`;

    const latest = data.latest_issuance_detail;
    const issuance = latest?.issuance;

    const deptName = text(p.department?.DepartmentName ?? p.endUser?.department?.DepartmentName, 'Not recorded');
    const endUser = getRequesterName(p);

    const propertyNo = text(p.inventoryDetail?.PropertyNumber, 'Not recorded');
    const brand = text(p.inventoryDetail?.Brand, 'Not recorded');
    const model = text(p.inventoryDetail?.ModelNumber, 'Not recorded');
    const serial = text(p.inventoryDetail?.SerialNumber, 'Not recorded');

    const statusName = text(p.propertyStatus?.StatusName, 'Not recorded');
    const conditionName = text(p.condition?.ConditionName, 'Not recorded');

    return (
        <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}>
            <div className="p-6 max-w-6xl mx-auto space-y-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                        type="button"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold text-slate-900">Property Oversight</h1>
                        <p className="text-slate-500 text-sm truncate" title={title}>{title}</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <Link
                        href={`/qr/scan/${p.PropertyID}`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium"
                    >
                        <QrCode className="w-4 h-4" />
                        Open QR Verification
                    </Link>
                    <Link
                        href={`${baseRoute}/issuance`}
                        className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                    >
                        <FileText className="w-4 h-4" />
                        Issuance Documents
                    </Link>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Accountability Summary</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Property Card Number</label>
                            <p className="mt-1 text-slate-900">{propertyCard}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Assigned Date</label>
                            <p className="mt-1 text-slate-900">{formatPHDate(p.AssignedDate)}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Department</label>
                            <p className="mt-1 text-slate-900">{deptName}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">End User</label>
                            <p className="mt-1 text-slate-900">{endUser}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Status</label>
                            <p className="mt-1 text-slate-900">{statusName}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Condition</label>
                            <p className="mt-1 text-slate-900">{conditionName}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Asset Details</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Item</label>
                            <p className="mt-1 text-slate-900">{itemName}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Property Number</label>
                            <p className="mt-1 text-slate-900">{propertyNo}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Brand</label>
                            <p className="mt-1 text-slate-900">{brand}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Model</label>
                            <p className="mt-1 text-slate-900">{model}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Serial</label>
                            <p className="mt-1 text-slate-900">{serial}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Remarks</label>
                            <p className="mt-1 text-slate-900">{text(p.Remarks, 'Not recorded')}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Latest Issuance</h2>
                    {issuance ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Document</label>
                                <p className="mt-1 text-slate-900">{text(issuance.DocumentNumber, 'Not recorded')}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Document Type</label>
                                <p className="mt-1 text-slate-900">{text(issuance.DocumentType, 'Not recorded')}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Status</label>
                                <p className="mt-1 text-slate-900">{text(issuance.Status, 'Not recorded')}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Date Issued</label>
                                <p className="mt-1 text-slate-900">{formatPHDate(issuance.DateIssued)}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Issued By</label>
                                <p className="mt-1 text-slate-900">{text(issuance.issuedBy?.FullName ?? issuance.issued_by?.FullName, 'Not recorded')}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Acknowledged At</label>
                                <p className="mt-1 text-slate-900">{formatPHDate(issuance.AcknowledgedAt ?? null)}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="text-sm text-slate-600">No issuance record available for this item.</div>
                    )}
                </div>
            </div>
        </div>
    );
}

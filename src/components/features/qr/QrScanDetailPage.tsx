'use client';

import { useQuery } from '@tanstack/react-query';
import { scanProperty } from '@/lib/api/qr';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { useEffect } from 'react';
import { QRCodeWithPrint } from '@/components/ui/QRCodeWithPrint';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

function fmt(dateString?: string | null): string {
    if (!dateString) return 'Not recorded';
    const parsed = new Date(dateString);
    if (Number.isNaN(parsed.getTime())) return 'Not recorded';
    const date = toZonedTime(parsed, 'Asia/Manila');
    return format(date, 'PPPp');
}

export function QrScanDetailPage() {
    const params = useParams();
    const rawId = params?.propertyId;
    const propertyId = typeof rawId === 'string' ? Number(rawId) : NaN;

    const { data, isLoading, error } = useQuery({
        queryKey: ['qr-scan', propertyId],
        queryFn: () => scanProperty(propertyId),
        enabled: Number.isInteger(propertyId) && propertyId > 0,
        retry: 1,
    });

    useEffect(() => {
        if (error) {
            const message = error instanceof Error ? error.message : 'Failed to load scan result';
            toast.error(message);
        }
    }, [error]);

    if (!Number.isInteger(propertyId) || propertyId <= 0) {
        return <div className="p-6 text-sm text-red-600">Invalid PropertyID.</div>;
    }

    if (isLoading) {
        return null;
    }

    const property = data?.property;
    if (!property) {
        return <div className="p-6 text-sm text-slate-600">No data found.</div>;
    }

    const itemName = property.inventoryDetail?.drDetail?.ItemDescription
        ?? property.Description
        ?? 'Item not recorded';
    const propertyNo = property.inventoryDetail?.PropertyNumber ?? 'Property number not recorded';
    const propertyCardNo = property.PropertyCardNumber ?? 'Property card not recorded';
    const endUserName = property.endUser?.FullName ?? 'End user not recorded';
    const deptName = property.department?.DepartmentName
        ?? property.endUser?.department?.DepartmentName
        ?? 'Department not recorded';
    const statusName = property.propertyStatus?.StatusName ?? 'Status not recorded';
    const conditionName = property.condition?.ConditionName ?? 'Condition not recorded';

    const latest = data.latest_issuance_detail;
    const issuance = latest?.issuance;

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const qrValue = property.qrCode?.QRCodeData ?? `${origin}/qr/scan/${property.PropertyID}`;

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Property Scan Result</h1>
                <p className="text-sm text-slate-600">PropertyID: {property.PropertyID}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white rounded-xl border border-slate-200 p-10" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                        <div className="text-3xl font-extrabold tracking-wide text-blue-600 mb-10">
                            PROPERTY {propertyCardNo}
                        </div>

                        <div className="space-y-6 text-blue-600">
                            <div className="flex items-end gap-4">
                                <div className="w-28 text-lg">Name:</div>
                                <div className="flex-1 border-b border-blue-400 pb-1 text-slate-900 text-lg">
                                    {endUserName}
                                </div>
                            </div>

                            <div className="flex items-end gap-4">
                                <div className="w-28 text-lg">Item Name:</div>
                                <div className="flex-1 border-b border-blue-400 pb-1 text-slate-900 text-lg">
                                    {itemName}
                                </div>
                            </div>

                            <div className="flex items-end gap-4">
                                <div className="w-28 text-lg">Department:</div>
                                <div className="flex-1 border-b border-blue-400 pb-1 text-slate-900 text-lg">
                                    {deptName}
                                </div>
                            </div>

                            <div className="flex items-end gap-4">
                                <div className="w-28 text-lg">Property No:</div>
                                <div className="flex-1 border-b border-blue-400 pb-1 text-slate-900 text-lg">
                                    {propertyNo}
                                </div>
                            </div>

                            <div className="flex items-end gap-4">
                                <div className="w-28 text-lg">Status:</div>
                                <div className="flex-1 border-b border-blue-400 pb-1 text-slate-900 text-lg">
                                    {statusName}
                                </div>
                            </div>

                            <div className="flex items-end gap-4">
                                <div className="w-28 text-lg">Condition:</div>
                                <div className="flex-1 border-b border-blue-400 pb-1 text-slate-900 text-lg">
                                    {conditionName}
                                </div>
                            </div>

                            <div className="flex items-end gap-4">
                                <div className="w-28 text-lg">Date:</div>
                                <div className="flex-1 border-b border-blue-400 pb-1 text-slate-900 text-lg">
                                    {fmt(property.AssignedDate)}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                        <div className="font-semibold text-slate-900">Latest Issuance</div>
                        {!issuance ? (
                            <div className="text-sm text-slate-600 mt-2">No issuance record found for this item.</div>
                        ) : (
                            <div className="text-sm text-slate-700 mt-2 space-y-1">
                                <div>
                                    Document: {issuance.DocumentType} {issuance.DocumentNumber}
                                </div>
                                <div>Status: {issuance.Status}</div>
                                <div>Date Issued: {fmt(issuance.DateIssued)}</div>
                                <div>Acknowledged At: {fmt(issuance.AcknowledgedAt)}</div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4 h-fit">
                    <div className="font-semibold text-slate-900 mb-3">QR Code</div>
                    <QRCodeWithPrint value={qrValue} title="GSO Property QR" />
                </div>
            </div>
        </div>
    );
}

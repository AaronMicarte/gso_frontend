'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit, ClipboardCheck, AlertCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { getDeliveryReceipt } from '@/lib/api/deliveryReceipts';
import { DeliveryReceipt } from '@/types/procurement';
import { toast } from 'sonner';
import { useAuth } from '@/lib/hooks/useAuth';

interface ViewDRPageProps {
    baseRoute: string;
}

export function ViewDRPage({ baseRoute }: ViewDRPageProps) {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const [dr, setDr] = useState<DeliveryReceipt | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Permissions
    const canEdit = user?.UserRoleID === 1 || user?.UserRoleID === 2; // Admin or Staff
    const canCreateIAR = user?.UserRoleID === 1 || user?.UserRoleID === 2; // Admin or Staff

    useEffect(() => {
        const fetchDR = async () => {
            try {
                const id = params.id as string;
                const data = await getDeliveryReceipt(parseInt(id));
                setDr(data);
            } catch {
                toast.error('Failed to load delivery receipt');
                router.push(`${baseRoute}/delivery-receipts`);
            } finally {
                setIsLoading(false);
            }
        };

        if (params.id) {
            fetchDR();
        }
    }, [params.id, router, baseRoute]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)] mx-auto" />
                    <p className="text-slate-600">Loading delivery receipt...</p>
                </div>
            </div>
        );
    }

    if (!dr) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center space-y-3">
                    <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
                    <p className="text-slate-600">Delivery receipt not found</p>
                    <Link
                        href={`${baseRoute}/delivery-receipts`}
                        className="text-[var(--primary)] hover:underline"
                    >
                        Back to list
                    </Link>
                </div>
            </div>
        );
    }

    const totalAmount = dr.details ? dr.details.reduce((sum, item) => {
        const cost = item.TotalCost ? parseFloat(String(item.TotalCost)) : 0;
        return sum + cost;
    }, 0) : 0;

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                    type="button"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Delivery Receipt Details</h1>
                    <p className="text-slate-500 text-sm">DR Number: {dr.DRNumber}</p>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
                {canEdit && !dr?.hasIAR && (
                    <Link
                        href={`${baseRoute}/delivery-receipts/${dr.DRID}/edit`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 transition-colors font-medium"
                    >
                        <Edit className="w-4 h-4" />
                        Edit DR
                    </Link>
                )}
                {!dr.hasIAR && canCreateIAR && (
                    <Link
                        href={`${baseRoute}/delivery-receipts/create-iar?dr_id=${dr.DRID}`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                    >
                        <ClipboardCheck className="w-4 h-4" />
                        Create IAR
                    </Link>
                )}
            </div>

            {/* DR Header */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Delivery Receipt Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">DR Number</label>
                        <p className="mt-1 text-slate-900">{dr.DRNumber}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Supplier Name</label>
                        <p className="mt-1 text-slate-900">{dr.SupplierName || 'N/A'}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">PO Number</label>
                        <p className="mt-1 text-slate-900">{dr.PONumber || 'N/A'}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Invoice Number</label>
                        <p className="mt-1 text-slate-900">{dr.InvoiceNumber || 'N/A'}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Date Received</label>
                        <p className="mt-1 text-slate-900">{
                            (() => {
                                const zonedDate = toZonedTime(new Date(dr.DateReceived), 'Asia/Manila');
                                return format(zonedDate, 'PPP');
                            })()
                        }</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Received By</label>
                        <p className="mt-1 text-slate-900">{dr.receivedByUser?.FullName || 'Unknown'}</p>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700">Remarks</label>
                        <p className="mt-1 text-slate-900">{dr.Remarks || 'No remarks'}</p>
                    </div>
                </div>
            </div>

            {/* Items Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Delivered Items</h2>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200">
                                <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">#</th>
                                <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">Item Description</th>
                                <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">Property Type</th>
                                <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">Quantity</th>
                                <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">UoM</th>
                                <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">Unit Cost</th>
                                <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">Total Cost</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {dr.details?.map((item, index) => (
                                <tr key={item.DRDetailID}>
                                    <td className="py-3 px-3 text-sm text-slate-600">{index + 1}</td>
                                    <td className="py-3 px-3 text-sm text-slate-900">{item.ItemDescription}</td>
                                    <td className="py-3 px-3 text-sm text-slate-600">{item.propertyType?.PropertyName || 'Unknown'}</td>
                                    <td className="py-3 px-3 text-sm text-slate-600">{item.QuantityDelivered}</td>
                                    <td className="py-3 px-3 text-sm text-slate-600">{item.unitOfMeasure?.UnitName || 'N/A'}</td>
                                    <td className="py-3 px-3 text-sm text-slate-600">₱{parseFloat(String(item.UnitCost)).toFixed(2)}</td>
                                    <td className="py-3 px-3 text-sm text-slate-600">₱{parseFloat(String(item.TotalCost)).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Summary */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Summary</h2>
                <div className="flex items-center justify-between text-lg">
                    <span className="text-slate-600">Total Amount:</span>
                    <span className="font-bold text-slate-900">₱{totalAmount.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}</span>
                </div>
                <div className="flex items-center justify-between mt-4">
                    <span className="text-slate-600">IAR Status:</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${dr.hasIAR
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                        }`}>
                        {dr.hasIAR ? (
                            <>
                                <ClipboardCheck className="w-3 h-3" />
                                Inspected
                            </>
                        ) : (
                            <>
                                <AlertCircle className="w-3 h-3" />
                                Pending IAR
                            </>
                        )}
                    </span>
                </div>
            </div>
        </div>
    );
}

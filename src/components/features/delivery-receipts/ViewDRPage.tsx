'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit, AlertCircle, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { getDeliveryReceipt } from '@/lib/api/deliveryReceipts';
import { DeliveryReceipt } from '@/types/procurement';
import { toast } from 'sonner';
import { useAuth } from '@/lib/hooks/useAuth';

interface ViewDRPageProps {
    baseRoute: string;
    drId?: number;
    isModal?: boolean;
    onClose?: () => void;
}

export function ViewDRPage({ baseRoute, drId, isModal = false, onClose }: ViewDRPageProps) {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const [dr, setDr] = useState<DeliveryReceipt | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const resolvedId = drId ?? (params.id ? parseInt(params.id as string, 10) : null);

    // Permissions
    const canEdit = user?.UserRoleID === 1 || user?.UserRoleID === 2; // Admin or Staff
    const inspectionStatus = dr?.inspection_status || dr?.InspectionStatus || 'pending';
    // prioritise the workflow status set by the backend, fallback to inspection state if missing
    const workflowStatus = dr?.workflow_status || (inspectionStatus === 'inspected' ? 'to_be_issued' : 'pending_inspection');
    const workflowLabel = dr?.workflow_status_label || (workflowStatus === 'to_be_issued' ? 'To be issued' : workflowStatus === 'issued' ? 'Issued' : workflowStatus === 'acknowledged' ? 'Acknowledged' : (workflowStatus === 'pending_inspection' ? 'Pending inspection' : ''));

    useEffect(() => {
        const fetchDR = async () => {
            try {
                if (!resolvedId) return;
                const data = await getDeliveryReceipt(resolvedId);
                setDr(data);
            } catch {
                toast.error('Failed to load delivery receipt');
                if (isModal) {
                    onClose?.();
                } else {
                    router.push(`${baseRoute}/delivery-receipts`);
                }
            } finally {
                setIsLoading(false);
            }
        };

        if (resolvedId) {
            fetchDR();
        }
    }, [resolvedId, router, baseRoute, isModal, onClose]);

    if (isLoading) {
        return null;
    }

    if (!dr) {
        return (
            <div className={`flex items-center justify-center ${isModal ? 'py-10' : 'min-h-screen'}`} style={isModal ? undefined : { backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundAttachment: 'fixed' }}>
                <div className="text-center space-y-3">
                    <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
                    <p className="text-slate-600">Delivery receipt not found</p>
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
                            href={`${baseRoute}/delivery-receipts`}
                            className="text-[var(--primary)] hover:underline"
                        >
                            Back to list
                        </Link>
                    )}
                </div>
            </div>
        );
    }

    const totalAmount = dr.details ? dr.details.reduce((sum, item) => {
        const cost = item.TotalCost ? parseFloat(String(item.TotalCost)) : 0;
        return sum + cost;
    }, 0) : 0;

    return (
        <div className={isModal ? 'print:hidden' : 'min-h-screen bg-cover bg-center bg-no-repeat print:hidden'} style={isModal ? undefined : { backgroundImage: "url('/assets/images/background/bg.jpg')" }}>
            <div className="p-6 max-w-6xl mx-auto space-y-6">
                <div className="flex items-center gap-4">
                    {isModal ? (
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                            type="button"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    ) : (
                        <button
                            onClick={() => router.back()}
                            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                            type="button"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Delivery Receipt Details</h1>
                        <p className="text-slate-500 text-sm">DR Number: {dr.DRNumber}</p>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3">
                    <Link
                        href={`${baseRoute}/delivery-receipts/${dr.DRID}/print`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium"
                    >
                        <Printer className="w-4 h-4" />
                        Print DR
                    </Link>
                    {canEdit && inspectionStatus !== 'inspected' && (
                        <Link
                            href={`${baseRoute}/delivery-receipts/${dr.DRID}/edit`}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 transition-colors font-medium"
                        >
                            <Edit className="w-4 h-4" />
                            Edit DR
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
                            <label className="block text-sm font-medium text-slate-700">IAR Number</label>
                            <p className="mt-1 text-slate-900">
                                {dr.IARNumber ? (
                                    <span className="font-mono">{dr.IARNumber}</span>
                                ) : (
                                    <span className="text-slate-500 italic">Pending generation</span>
                                )}
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Supplier Name</label>
                            <p className="mt-1 text-slate-900">{dr.SupplierName || 'N/A'}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Requested By</label>
                            <p className="mt-1 text-slate-900">{dr.requestedByUser?.FullName || dr.RequestedByName || 'N/A'}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Department</label>
                            <p className="mt-1 text-slate-900">{dr.requestedByUser?.department?.DepartmentName || dr.DepartmentName || 'N/A'}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">PR Number</label>
                            <p className="mt-1 text-slate-900">{dr.PRNumber || 'N/A'}</p>
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
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Inspected By</label>
                            <p className="mt-1 text-slate-900">{dr.receivedByUser?.FullName || 'Unknown'}</p>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700">Remarks</label>
                            <p className="mt-1 text-slate-900">{dr.Remarks || 'No remarks'}</p>
                        </div>
                        {dr.dr_picture_url && (
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-2">DR Picture</label>
                                <img
                                    src={dr.dr_picture_url}
                                    alt="DR Picture"
                                    className="max-w-full h-auto rounded-lg border border-slate-200"
                                    style={{ maxHeight: '400px' }}
                                />
                            </div>
                        )}
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
                                    <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">Article</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">Item Description</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-slate-700 min-w-[160px]">Property Type</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-slate-700 min-w-[220px]">Details</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-slate-700 w-24">Qty</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">Unit Cost</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">Total Cost</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">Requested / Delivered</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {dr.details?.map((item, index) => (
                                    <tr key={item.DRDetailID}>
                                        <td className="py-3 px-3 text-sm text-slate-600">{index + 1}</td>
                                        <td className="py-3 px-3 text-sm text-slate-900">{item.article?.ArticleName || '—'}</td>
                                        <td className="py-3 px-3 text-sm text-slate-900">{item.ItemDescription}</td>
                                        <td className="py-3 px-3 min-w-[160px] text-sm text-slate-600">{item.propertyType?.PropertyName || ''}</td>
                                        <td className="py-3 px-3 min-w-[220px] text-sm text-slate-600">
                                            <div className="text-sm text-slate-700">
                                                {item.Brand && <span className="mr-2">{`Brand: ${item.Brand}`}</span>}
                                                {item.ModelNumber && <span className="mr-2">{`Model: ${item.ModelNumber}`}</span>}
                                                {item.SerialNumber && <span className="mr-2">{`Serial: ${item.SerialNumber}`}</span>}
                                            </div>
                                        </td>
                                        <td className="py-3 px-3 w-28 text-center">
                                            <div className="text-sm">{item.QuantityDelivered}</div>
                                            <div className="text-xs text-slate-500 mt-1">{item.unitOfMeasure?.UnitName || 'N/A'}</div>
                                        </td>
                                        <td className="py-3 px-3 text-sm text-slate-600">₱{parseFloat(String(item.UnitCost)).toFixed(2)}</td>
                                        <td className="py-3 px-3 text-sm text-slate-600">₱{parseFloat(String(item.TotalCost)).toFixed(2)}</td>
                                        <td className="py-3 px-3 text-sm text-slate-600">
                                            <div>
                                                <span className="font-medium">R:</span>{' '}{(item.QuantityRequested ?? item.QuantityDelivered ?? 0)}{' '}
                                                <span className="font-medium">D:</span>{' '}{item.QuantityDelivered ?? 0}
                                            </div>
                                            {item.QuantityRequested !== item.QuantityDelivered && item.ChangeReason && (
                                                <div className="text-xs text-slate-500 mt-1">Reason: {item.ChangeReason}</div>
                                            )}
                                        </td>
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
                        <span className="text-slate-600">Status:</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${workflowStatus === 'pending_inspection' ? 'bg-amber-100 text-amber-700' : workflowStatus === 'to_be_issued' ? 'bg-indigo-100 text-indigo-700' : workflowStatus === 'issued' ? 'bg-emerald-100 text-emerald-700' : workflowStatus === 'acknowledged' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                            {workflowLabel}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

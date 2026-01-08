'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save, Package, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import issuanceAPI from '@/lib/api/issuance';
import { AssetRequest } from '@/types/assetIssuance';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { SignatureModal } from '@/components/ui/SignatureModal';

const issuanceSchema = z.object({
    RequestID: z.number().min(1, 'Request is required'),
    DateIssued: z.string().min(1, 'Issue date is required'),
    IssuanceNotes: z.string().optional(),
});

type IssuanceFormValues = z.infer<typeof issuanceSchema>;

interface CreateIssuancePageProps {
    baseRoute: string;
}

export function CreateIssuancePage({ baseRoute }: CreateIssuancePageProps) {
    const router = useRouter();
    const [approvedRequests, setApprovedRequests] = useState<AssetRequest[]>([]);
    const [selectedRequest, setSelectedRequest] = useState<AssetRequest | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Signature states
    const [showSignatureModal, setShowSignatureModal] = useState(false);
    const [issuerSignature, setIssuerSignature] = useState<string | null>(null);
    const [issuerSignatureSource, setIssuerSignatureSource] = useState<'canvas' | 'upload' | null>(null);

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors }
    } = useForm<IssuanceFormValues>({
        resolver: zodResolver(issuanceSchema),
        defaultValues: {
            DateIssued: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
        }
    });

    const watchedRequestId = watch('RequestID');

    useEffect(() => {
        loadApprovedRequests();
    }, []);

    useEffect(() => {
        if (watchedRequestId) {
            const request = approvedRequests.find(r => r.RequestID === Number(watchedRequestId));
            setSelectedRequest(request || null);
        } else {
            setSelectedRequest(null);
        }
    }, [watchedRequestId, approvedRequests]);

    const loadApprovedRequests = async () => {
        try {
            setLoading(true);
            const response = await issuanceAPI.getApprovedRequests({
                per_page: 100
            });

            // Handle the response - backend returns {data: [...], message: string, total: number}
            const requests = Array.isArray(response.data) ? response.data : [];

            setApprovedRequests(requests);

            if (requests.length === 0) {
                toast.info('No approved requests available for issuance');
            }
        } catch (error) {
            console.error('Failed to load approved requests:', error);
            toast.error('Failed to load approved requests');
            setApprovedRequests([]); // Ensure empty array on error
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = async (data: IssuanceFormValues) => {
        if (!selectedRequest) {
            toast.error('Please select a request to issue');
            return;
        }

        if (!issuerSignature || !issuerSignatureSource) {
            toast.error('Please provide your signature to issue these assets');
            return;
        }

        try {
            setIsSubmitting(true);
            await issuanceAPI.issueFromRequest(data.RequestID, {
                request_id: data.RequestID,
                date_issued: data.DateIssued,
                remarks: data.IssuanceNotes || null,
                issuerSignature,
                issuerSignatureSource: issuerSignatureSource as 'canvas' | 'upload',
            });

            toast.success('Assets issued successfully!');
            router.push(baseRoute);
        } catch (error) {
            console.error('Failed to issue assets:', error);
            toast.error('Failed to issue assets');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getDocumentTypeInfo = (classification: string | null) => {
        if (!classification) return { type: 'Unknown', color: 'bg-gray-100 text-gray-800' };

        return classification === 'PAR'
            ? { type: 'PAR', color: 'bg-purple-100 text-purple-800' }
            : { type: 'ICS', color: 'bg-indigo-100 text-indigo-800' };
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="flex items-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
                    <span className="ml-3 text-gray-600">Loading approved requests...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')" }}>
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <Link
                            href={baseRoute}
                            className="mr-4 inline-flex items-center text-sm text-slate-600 hover:text-slate-800"
                        >
                            <ArrowLeft className="w-4 h-4 mr-1" />
                            Back to Issuances
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Issue Assets</h1>
                            <p className="mt-1 text-sm text-slate-500">
                                Issue approved asset requests to end users
                            </p>
                        </div>
                    </div>
                </div>

                {approvedRequests.length === 0 ? (
                    <div className="bg-white shadow rounded-lg">
                        <div className="text-center py-12">
                            <Package className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-sm font-medium text-gray-900">No approved requests</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                There are no approved asset requests ready for issuance.
                            </p>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        {/* Request Selection */}
                        <div className="bg-white shadow rounded-lg">
                            <div className="px-4 py-5 sm:p-6">
                                <div className="md:grid md:grid-cols-3 md:gap-6">
                                    <div className="md:col-span-1">
                                        <h3 className="text-lg font-medium leading-6 text-gray-900">Select Request</h3>
                                        <p className="mt-1 text-sm text-gray-500">
                                            Choose an approved asset request to issue
                                        </p>
                                    </div>
                                    <div className="mt-5 md:mt-0 md:col-span-2">
                                        <div>
                                            <label htmlFor="RequestID" className="block text-sm font-medium text-gray-700">
                                                Approved Request
                                            </label>
                                            <select
                                                {...register('RequestID', { valueAsNumber: true })}
                                                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-[var(--primary)] focus:border-[var(--primary)] sm:text-sm rounded-md"
                                            >
                                                <option value="">Select a request...</option>
                                                {approvedRequests.map((request) => (
                                                    <option key={request.RequestID} value={request.RequestID}>
                                                        {request.RequestNumber} - {request.requester?.FullName} ({request.department?.DepartmentName})
                                                    </option>
                                                ))}
                                            </select>
                                            {errors.RequestID && (
                                                <p className="mt-2 text-sm text-red-600">{errors.RequestID.message}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Request Details */}
                        {selectedRequest && (
                            <div className="bg-white shadow rounded-lg">
                                <div className="px-4 py-5 sm:p-6">
                                    <div className="md:grid md:grid-cols-3 md:gap-6">
                                        <div className="md:col-span-1">
                                            <h3 className="text-lg font-medium leading-6 text-gray-900">Request Details</h3>
                                            <p className="mt-1 text-sm text-gray-500">
                                                Review the request information before issuing
                                            </p>
                                        </div>
                                        <div className="mt-5 md:mt-0 md:col-span-2">
                                            <div className="border border-gray-200 rounded-lg p-4">
                                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Request Number</label>
                                                        <p className="mt-1 text-sm text-gray-900">{selectedRequest.RequestNumber}</p>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Requested By</label>
                                                        <p className="mt-1 text-sm text-gray-900">{selectedRequest.requester?.FullName}</p>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Department</label>
                                                        <p className="mt-1 text-sm text-gray-900">{selectedRequest.department?.DepartmentName}</p>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Request Date</label>
                                                        <p className="mt-1 text-sm text-gray-900">
                                                            {format(toZonedTime(new Date(selectedRequest.RequestDate), 'Asia/Manila'), 'PPp')}
                                                        </p>
                                                    </div>
                                                    {selectedRequest.Purpose && (
                                                        <div className="sm:col-span-2">
                                                            <label className="block text-sm font-medium text-gray-700">Purpose</label>
                                                            <p className="mt-1 text-sm text-gray-900">{selectedRequest.Purpose}</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Request Items */}
                                                {selectedRequest.details && selectedRequest.details.length > 0 && (
                                                    <div className="mt-6">
                                                        <h4 className="text-sm font-medium text-gray-900 mb-3">Requested Items</h4>
                                                        <div className="overflow-x-auto">
                                                            <table className="min-w-full divide-y divide-gray-200">
                                                                <thead className="bg-gray-50">
                                                                    <tr>
                                                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                                                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                                                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Classification</th>
                                                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End User</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="bg-white divide-y divide-gray-200">
                                                                    {selectedRequest.details.map((detail) => {
                                                                        const docInfo = getDocumentTypeInfo(detail.PropertyClassification);
                                                                        return (
                                                                            <tr key={detail.RequestDetailID}>
                                                                                <td className="px-4 py-2 text-sm text-gray-900">
                                                                                    {detail.ItemDescription}
                                                                                    {detail.AdditionalNotes && (
                                                                                        <p className="text-xs text-gray-500 mt-1">{detail.AdditionalNotes}</p>
                                                                                    )}
                                                                                </td>
                                                                                <td className="px-4 py-2 text-sm text-gray-900">
                                                                                    {detail.QuantityRequested} {detail.Unit}
                                                                                </td>
                                                                                <td className="px-4 py-2">
                                                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${docInfo.color}`}>
                                                                                        {docInfo.type}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="px-4 py-2 text-sm text-gray-900">
                                                                                    {detail.IntendedEndUser || 'Not specified'}
                                                                                    {detail.AdminNotes && (
                                                                                        <p className="text-xs text-gray-500 mt-1">Admin: {detail.AdminNotes}</p>
                                                                                    )}
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Review Information */}
                                                {selectedRequest.ReviewNotes && (
                                                    <div className="mt-4">
                                                        <label className="block text-sm font-medium text-gray-700">Review Notes</label>
                                                        <p className="mt-1 text-sm text-gray-900 bg-green-50 p-2 rounded border">
                                                            {selectedRequest.ReviewNotes}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Issuance Date */}
                        {selectedRequest && (
                            <div className="bg-white shadow rounded-lg">
                                <div className="px-4 py-5 sm:p-6">
                                    <div className="md:grid md:grid-cols-3 md:gap-6">
                                        <div className="md:col-span-1">
                                            <h3 className="text-lg font-medium leading-6 text-gray-900">Issue Date</h3>
                                            <p className="mt-1 text-sm text-gray-500">
                                                Date when the assets will be issued
                                            </p>
                                        </div>
                                        <div className="mt-5 md:mt-0 md:col-span-2">
                                            <div>
                                                <label htmlFor="DateIssued" className="block text-sm font-medium text-gray-700">
                                                    Date Issued <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="date"
                                                    {...register('DateIssued')}
                                                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-[var(--primary)] focus:border-[var(--primary)] sm:text-sm rounded-md"
                                                />
                                                {errors.DateIssued && (
                                                    <p className="mt-2 text-sm text-red-600">{errors.DateIssued.message}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Issuance Notes */}
                        {selectedRequest && (
                            <div className="bg-white shadow rounded-lg">
                                <div className="px-4 py-5 sm:p-6">
                                    <div className="md:grid md:grid-cols-3 md:gap-6">
                                        <div className="md:col-span-1">
                                            <h3 className="text-lg font-medium leading-6 text-gray-900">Issuance Notes</h3>
                                            <p className="mt-1 text-sm text-gray-500">
                                                Optional notes for the issuance process
                                            </p>
                                        </div>
                                        <div className="mt-5 md:mt-0 md:col-span-2">
                                            <div>
                                                <label htmlFor="IssuanceNotes" className="block text-sm font-medium text-gray-700">
                                                    Notes (Optional)
                                                </label>
                                                <textarea
                                                    {...register('IssuanceNotes')}
                                                    rows={3}
                                                    className="mt-1 shadow-sm focus:ring-[var(--primary)] focus:border-[var(--primary)] block w-full sm:text-sm border-gray-300 rounded-md"
                                                    placeholder="Enter any notes about the issuance..."
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Important Notice */}
                        {selectedRequest && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                <div className="flex">
                                    <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0" />
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-amber-800">Important Notice</h3>
                                        <p className="mt-2 text-sm text-amber-700">
                                            By issuing these assets, you confirm that:
                                        </p>
                                        <ul className="mt-2 text-sm text-amber-700 list-disc list-inside space-y-1">
                                            <li>All items are physically available and in good condition</li>
                                            <li>The recipient information has been verified</li>
                                            <li>Proper documentation (PAR/ICS) will be generated</li>
                                            <li>The recipient will be notified to acknowledge receipt</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Issuer Signature */}
                        {selectedRequest && (
                            <div className="bg-white border border-slate-200 rounded-lg p-6">
                                <h3 className="text-lg font-semibold text-slate-900 mb-4">Issuer Signature</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Your Signature <span className="text-red-500">*</span>
                                        </label>
                                        {issuerSignature ? (
                                            <div className="space-y-2">
                                                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                                                    <img
                                                        src={issuerSignature}
                                                        alt="Your signature"
                                                        className="max-h-20 max-w-full object-contain"
                                                    />
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowSignatureModal(true)}
                                                        className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 rounded"
                                                    >
                                                        Change Signature
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIssuerSignature(null);
                                                            setIssuerSignatureSource(null);
                                                        }}
                                                        className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => setShowSignatureModal(true)}
                                                className="w-full h-32 border-2 border-dashed border-slate-300 rounded-lg hover:border-slate-400 transition-colors flex items-center justify-center text-slate-500"
                                            >
                                                Click to add your signature
                                            </button>
                                        )}
                                        <p className="text-xs text-slate-500 mt-1">
                                            Your signature is required to issue these assets and confirms accountability.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Submit Button */}
                        <div className="flex justify-end space-x-3">
                            <Link
                                href={baseRoute}
                                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)]"
                            >
                                Cancel
                            </Link>
                            <button
                                type="submit"
                                disabled={!selectedRequest || isSubmitting}
                                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Issuing Assets...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4 mr-2" />
                                        Issue Assets
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}

                {/* Signature Modal */}
                <SignatureModal
                    open={showSignatureModal}
                    onOpenChange={setShowSignatureModal}
                    onSave={(dataUrl, source) => {
                        setIssuerSignature(dataUrl);
                        setIssuerSignatureSource(source);
                    }}
                    loading={isSubmitting}
                />
            </div>
        </div>
    );
}
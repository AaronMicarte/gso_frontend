'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from 'zod';
import { useCreateIAR } from '@/lib/hooks/useIAR';
import { useDeliveryReceipt } from '@/lib/hooks/useDeliveryReceipts';
import { getConditions, getUsers } from '@/lib/api/iar';
import { ArrowLeft, Save, AlertCircle, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatInTimeZone } from 'date-fns-tz';

const iarDetailSchema = z.object({
    dr_detail_id: z.number(),
    property_type_id: z.number(),
    condition_id: z.number().min(1, 'Condition is required'),
    quantity_accepted: z.number().min(0, 'Quantity accepted must be >= 0'),
    quantity_rejected: z.number().min(0, 'Quantity rejected must be >= 0'),
    remarks: z.string().optional(),
});

const iarSchema = z.object({
    dr_id: z.number(),
    inspected_by: z.number().min(1, 'Inspector is required'),
    accepted_by: z.number().min(1, 'Acceptor is required'),
    date_inspected: z.string().min(1, 'Inspection date is required'),
    date_accepted: z.string().optional(),
    remarks: z.string().optional(),
    details: z.array(iarDetailSchema).min(1, 'At least one item is required'),
}).refine(() => {
    // Validate that each item's accepted + rejected = delivered quantity
    return true; // We'll validate this on the backend
}, {
    message: 'Quantities must match delivered quantities'
});

type IARFormValues = z.infer<typeof iarSchema>;

interface Condition {
    ConditionID: number;
    ConditionName: string;
}

interface User {
    UserID: number;
    FullName: string;
}

export default function CreateIARPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const drId = searchParams.get('dr_id');

    const createMutation = useCreateIAR();
    const { data: drData, isLoading: isDRLoading } = useDeliveryReceipt(drId ? parseInt(drId) : 0);
    const [conditions, setConditions] = useState<Condition[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);

    const {
        register,
        control,
        handleSubmit,
        watch,
        formState: { errors, isSubmitting },
    } = useForm<IARFormValues>({
        resolver: zodResolver(iarSchema),
        defaultValues: {
            dr_id: drId ? parseInt(drId) : 0,
            inspected_by: 0,
            accepted_by: 0,
            date_inspected: formatInTimeZone(new Date(), 'Asia/Manila', 'yyyy-MM-dd'),
            date_accepted: formatInTimeZone(new Date(), 'Asia/Manila', 'yyyy-MM-dd'),
            remarks: '',
            details: [],
        },
    });

    const { fields, append } = useFieldArray({
        control,
        name: 'details',
    });

    useEffect(() => {
        if (!drId) {
            toast.error('No Delivery Receipt ID provided');
            router.push('/admin/delivery-receipts');
            return;
        }

        const fetchData = async () => {
            try {
                setIsLoadingData(true);
                const [conditionsData, usersData] = await Promise.all([
                    getConditions(),
                    getUsers(),
                ]);
                setConditions(conditionsData);
                setUsers(usersData);
            } catch (_error) {
                toast.error('Failed to load form data');
            } finally {
                setIsLoadingData(false);
            }
        };

        fetchData();
    }, [drId, router]);

    useEffect(() => {
        if (drData?.details && fields.length === 0) {
            // Initialize IAR details from DR details
            drData.details.forEach((detail) => {
                append({
                    dr_detail_id: detail.DRDetailID!,
                    property_type_id: detail.PropertyTypeID,
                    condition_id: 1, // Default to "Good"
                    quantity_accepted: detail.QuantityDelivered, // Default: accept all
                    quantity_rejected: 0,
                    remarks: '',
                });
            });
        }
    }, [drData, append, fields.length]);

    const details = watch('details');

    const onSubmit = async (data: IARFormValues) => {
        try {
            // Validate quantities
            const invalidItems = data.details.filter((detail, index) => {
                const drDetail = drData?.details?.[index];
                if (!drDetail) return false;
                const total = detail.quantity_accepted + detail.quantity_rejected;
                return total !== drDetail.QuantityDelivered;
            });

            if (invalidItems.length > 0) {
                toast.error('Accepted + Rejected quantities must equal delivered quantities');
                return;
            }

            await createMutation.mutateAsync(data);
            toast.success('Inspection & Acceptance Report created successfully');
            router.push('/admin/delivery-receipts');
        } catch (_error) {
            toast.error('Failed to create IAR');
        }
    };

    if (isDRLoading || isLoadingData) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)] mx-auto" />
                    <p className="text-slate-600">Loading form data...</p>
                </div>
            </div>
        );
    }

    if (!drData) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center space-y-3">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                    <p className="text-slate-600">Delivery Receipt not found</p>
                    <button
                        onClick={() => router.back()}
                        className="text-[var(--primary)] hover:underline"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

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
                    <h1 className="text-2xl font-bold text-slate-900">Create Inspection & Acceptance Report</h1>
                    <p className="text-slate-500 text-sm">Inspect and accept items from DR {drData.DRNumber}</p>
                </div>
            </div>

            {/* DR Info Card */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Delivery Receipt Information</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <span className="text-blue-600 font-medium">DR Number:</span>
                        <p className="text-blue-900">{drData.DRNumber}</p>
                    </div>
                    <div>
                        <span className="text-blue-600 font-medium">Supplier:</span>
                        <p className="text-blue-900">{drData.SupplierName}</p>
                    </div>
                    <div>
                        <span className="text-blue-600 font-medium">Date Received:</span>
                        <p className="text-blue-900">{new Date(drData.DateReceived).toLocaleDateString('en-PH')}</p>
                    </div>
                    <div>
                        <span className="text-blue-600 font-medium">Total Items:</span>
                        <p className="text-blue-900">{drData.details?.length || 0}</p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Inspection Information */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Inspection & Acceptance Details</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Inspected By */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Inspected By *
                            </label>
                            <select
                                {...register('inspected_by', { valueAsNumber: true })}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            >
                                <option value={0}>Select Inspector</option>
                                {users.map((user) => (
                                    <option key={user.UserID} value={user.UserID}>
                                        {user.FullName}
                                    </option>
                                ))}
                            </select>
                            {errors.inspected_by && (
                                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {errors.inspected_by.message}
                                </p>
                            )}
                        </div>

                        {/* Accepted By */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Accepted By *
                            </label>
                            <select
                                {...register('accepted_by', { valueAsNumber: true })}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            >
                                <option value={0}>Select Acceptor</option>
                                {users.map((user) => (
                                    <option key={user.UserID} value={user.UserID}>
                                        {user.FullName}
                                    </option>
                                ))}
                            </select>
                            {errors.accepted_by && (
                                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {errors.accepted_by.message}
                                </p>
                            )}
                        </div>

                        {/* Date Inspected */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Date Inspected *
                            </label>
                            <input
                                {...register('date_inspected')}
                                type="date"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            />
                            {errors.date_inspected && (
                                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {errors.date_inspected.message}
                                </p>
                            )}
                        </div>

                        {/* Date Accepted */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Date Accepted
                            </label>
                            <input
                                {...register('date_accepted')}
                                type="date"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            />
                        </div>
                    </div>

                    {/* Remarks */}
                    <div className="mt-6">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Inspection Remarks
                        </label>
                        <textarea
                            {...register('remarks')}
                            rows={3}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 resize-none"
                            placeholder="General inspection notes or remarks"
                        />
                    </div>
                </div>

                {/* Items Inspection */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Item Inspection & Acceptance</h2>
                    <div className="space-y-4">
                        {fields.map((field, index) => {
                            const drDetail = drData.details?.[index];
                            const currentDetail = details[index];
                            const totalQty = (currentDetail?.quantity_accepted || 0) + (currentDetail?.quantity_rejected || 0);
                            const isValid = totalQty === drDetail?.QuantityDelivered;

                            return (
                                <div key={field.id} className="border border-slate-200 rounded-lg p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <h3 className="font-medium text-slate-900">
                                                {drDetail?.ItemDescription}
                                            </h3>
                                            <p className="text-sm text-slate-500">
                                                Delivered: {drDetail?.QuantityDelivered} units • Unit Cost: ₱{drDetail?.UnitCost.toLocaleString('en-PH')}
                                            </p>
                                        </div>
                                        {isValid ? (
                                            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                                        ) : (
                                            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <input type="hidden" {...register(`details.${index}.dr_detail_id` as const)} />
                                        <input type="hidden" {...register(`details.${index}.property_type_id` as const)} />

                                        {/* Condition */}
                                        <div>
                                            <label className="block text-xs font-medium text-slate-700 mb-1">
                                                Condition *
                                            </label>
                                            <select
                                                {...register(`details.${index}.condition_id` as const, { valueAsNumber: true })}
                                                className="w-full px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/20 text-sm"
                                            >
                                                {conditions.map((condition) => (
                                                    <option key={condition.ConditionID} value={condition.ConditionID}>
                                                        {condition.ConditionName}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Quantity Accepted */}
                                        <div>
                                            <label className="block text-xs font-medium text-slate-700 mb-1">
                                                Accepted *
                                            </label>
                                            <input
                                                {...register(`details.${index}.quantity_accepted` as const, { valueAsNumber: true })}
                                                type="number"
                                                min="0"
                                                step="1"
                                                className="w-full px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/20 text-sm"
                                            />
                                        </div>

                                        {/* Quantity Rejected */}
                                        <div>
                                            <label className="block text-xs font-medium text-slate-700 mb-1">
                                                Rejected *
                                            </label>
                                            <input
                                                {...register(`details.${index}.quantity_rejected` as const, { valueAsNumber: true })}
                                                type="number"
                                                min="0"
                                                step="1"
                                                className="w-full px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/20 text-sm"
                                            />
                                        </div>

                                        {/* Item Remarks */}
                                        <div>
                                            <label className="block text-xs font-medium text-slate-700 mb-1">
                                                Remarks
                                            </label>
                                            <input
                                                {...register(`details.${index}.remarks` as const)}
                                                type="text"
                                                className="w-full px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/20 text-sm"
                                                placeholder="Notes..."
                                            />
                                        </div>
                                    </div>

                                    {!isValid && (
                                        <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" />
                                            Accepted ({currentDetail?.quantity_accepted || 0}) + Rejected ({currentDetail?.quantity_rejected || 0}) must equal Delivered ({drDetail?.QuantityDelivered})
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {errors.details && (
                        <p className="mt-4 text-sm text-red-600 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {errors.details.message}
                        </p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Creating IAR...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Create IAR
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}

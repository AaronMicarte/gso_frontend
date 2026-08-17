'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, Plus, AlertCircle, Loader2 } from 'lucide-react';
import { useForm, useFieldArray, Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ItemDetailsModal } from './ItemDetailsModal';
import { useAllUnitsOfMeasure } from '@/lib/hooks/masterData/useUnitsOfMeasure';
import { useAddDeliveryReceiptItems, useFinalizeDeliveryReceipt } from '@/lib/hooks/useDeliveryReceipts';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { getDeliveryReceipt, getPropertyTypes, getUsedSerialNumbers } from '@/lib/api/deliveryReceipts';
import { getActiveArticles } from '@/lib/api/masterData';
import { Article } from '@/types/masterData';
import { DeliveryReceipt } from '@/types/procurement';

const drItemSchema = z.object({
    article_id: z.number().min(1, 'Article is required'),
    item_description: z.string().max(1000, 'Item description is too long').optional().or(z.literal('')),
    brand: z.string().max(100, 'Brand is too long').optional().or(z.literal('')),
    model_number: z.string().max(100, 'Model number is too long').optional().or(z.literal('')),
    serial_number: z.string().max(100, 'Serial number is too long').optional().or(z.literal('')),
    property_type_id: z.number().min(1, 'Property type is required'),
    unit_of_measure_id: z.number().min(1, 'Unit of measure is required'),
    quantity_delivered: z.number().min(1, 'Quantity must be at least 1'),
    quantity_requested: z.number().min(1, 'Quantity must be at least 1'),
    change_reason: z.string().optional(),
    unit_cost: z.number().min(0, 'Unit cost must be non-negative'),
}).superRefine((data, ctx) => {
    if (data.quantity_delivered !== data.quantity_requested) {
        const reason = (data.change_reason || '').trim();
        if (!reason) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['change_reason'],
                message: 'Change reason is required when delivered differs from requested quantity',
            });
        }
    }

    const serials = String(data.serial_number || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    if (serials.length > 0) {
        if (data.quantity_delivered !== serials.length) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['quantity_delivered'],
                message: `Quantity delivered must equal number of serial numbers (${serials.length})`,
            });
        }
        if (data.quantity_requested !== serials.length) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['quantity_requested'],
                message: `Quantity requested must equal number of serial numbers (${serials.length})`,
            });
        }
    }
});

const addItemsSchema = z.object({
    details: z.array(drItemSchema),
    finalize_dr: z.boolean().optional(),
}).superRefine((data, ctx) => {
    if (!data.finalize_dr && data.details.length === 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['details'],
            message: 'Add at least one item or check Finalize DR',
        });
    }
});

type AddItemsFormValues = z.infer<typeof addItemsSchema>;

interface PropertyType {
    PropertyTypeID: number;
    PropertyName: string;
}

interface AddItemsDRPageProps {
    baseRoute: string;
}

export function AddItemsDRPage({ baseRoute }: AddItemsDRPageProps) {
    const params = useParams();
    const router = useRouter();
    const drId = parseInt(params.id as string, 10);
    const addItemsMutation = useAddDeliveryReceiptItems();
    const finalizeMutation = useFinalizeDeliveryReceipt();
    const { showConfirmDialog, ConfirmDialog } = useConfirmDialog();
    const [dr, setDr] = useState<DeliveryReceipt | null>(null);
    const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>([]);
    const [articles, setArticles] = useState<Article[]>([]);
    const [usedSerials, setUsedSerials] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);

    const {
        control,
        register,
        handleSubmit,
        watch,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<AddItemsFormValues>({
        resolver: zodResolver(addItemsSchema),
        defaultValues: { details: [], finalize_dr: false },
    });

    const { fields, append } = useFieldArray({
        control,
        name: 'details',
    });

    const details = watch('details');
    const finalizeDr = watch('finalize_dr') === true;
    const isSaving = isSubmitting || addItemsMutation.isPending || finalizeMutation.isPending;

    const { data: unitsData } = useAllUnitsOfMeasure();
    type UnitOfMeasureResponse = { id?: number; name?: string; UnitOfMeasureID?: number; UnitName?: string };
    const units = Array.isArray(unitsData)
        ? (unitsData as UnitOfMeasureResponse[])
            .filter((u) => u && (u.id ?? u.UnitOfMeasureID))
            .map((u) => ({ id: u.id ?? u.UnitOfMeasureID!, name: u.name ?? u.UnitName! }))
        : [];

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [drData, propertyTypesData, articlesData, usedSerialsData] = await Promise.all([
                    getDeliveryReceipt(drId),
                    getPropertyTypes(),
                    getActiveArticles(),
                    getUsedSerialNumbers(),
                ]);

                const isPartial = drData.is_partial ?? drData.IsPartial;
                const isFinalized = !!drData.FinalizedAt;

                if (!isPartial || isFinalized) {
                    toast.error(isFinalized
                        ? 'This delivery receipt has already been finalized.'
                        : 'This delivery receipt is not partial.');
                    router.push(`${baseRoute}/delivery-receipts`);
                    return;
                }

                setDr(drData);
                setPropertyTypes(propertyTypesData);
                setArticles(articlesData);
                setUsedSerials(usedSerialsData || []);
            } catch {
                toast.error('Failed to load delivery receipt');
                router.push(`${baseRoute}/delivery-receipts`);
            } finally {
                setIsLoading(false);
            }
        };

        if (drId) {
            fetchData();
        }
    }, [drId, router, baseRoute]);

    const handleSaveItem = async (values: z.infer<typeof drItemSchema>) => {
        append(values);
        setIsItemModalOpen(false);
    };

    const submitForm = async (data: AddItemsFormValues) => {
        try {
            if (data.details.length > 0) {
                await addItemsMutation.mutateAsync({
                    id: drId,
                    details: data.details as unknown as Record<string, unknown>[],
                });
            }

            if (data.finalize_dr) {
                await finalizeMutation.mutateAsync(drId);
                toast.success(data.details.length > 0
                    ? 'Items added and delivery receipt finalized'
                    : 'Delivery receipt finalized');
            } else {
                toast.success('Items added successfully');
            }

            router.push(`${baseRoute}/delivery-receipts`);
        } catch (err: unknown) {
            const resp = (err as { response?: { data?: { errors?: Record<string, string | string[]>; message?: string } } })?.response?.data;
            if (resp?.errors) {
                Object.entries(resp.errors).forEach(([field, messages]) => {
                    const message = Array.isArray(messages) ? messages[0] : String(messages);
                    try {
                        setError(field as Path<AddItemsFormValues>, { type: 'server', message });
                    } catch {
                        // ignore unmapped fields
                    }
                });
                return;
            }
            toast.error(resp?.message || 'Failed to save changes');
        }
    };

    const onSubmit = async (data: AddItemsFormValues) => {
        if (data.finalize_dr) {
            showConfirmDialog({
                title: 'Finalize Delivery Receipt',
                description: 'This will permanently remove the Partial status. No more items can be added after finalizing. Issued items will remain issued.',
                confirmText: 'Finalize DR',
                onConfirm: () => submitForm(data),
            });
            return;
        }

        await submitForm(data);
    };

    const totalAmount = details?.reduce((sum, item) => sum + (item.quantity_delivered * (item.unit_cost || 0)), 0) || 0;

    if (isLoading) {
        return null;
    }

    if (!dr) {
        return null;
    }

    return (
        <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: 'fixed' }}>
            <ConfirmDialog />
            <div className="p-6 max-w-5xl mx-auto space-y-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                        type="button"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Add Items to Delivery Receipt</h1>
                        <p className="text-slate-500 text-sm">DR Number: {dr.DRNumber}</p>
                    </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                    This delivery receipt is partial. Add the remaining delivered items below, or check Finalize DR when all pending deliveries are complete.
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Existing Items</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200">
                                    <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">#</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">Article</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">Description</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">Qty</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dr.details?.map((item, index) => (
                                    <tr key={item.DRDetailID} className="border-b border-slate-100">
                                        <td className="py-3 px-3 text-sm text-slate-600">{index + 1}</td>
                                        <td className="py-3 px-3 text-sm text-slate-700">{item.article?.ArticleName || '—'}</td>
                                        <td className="py-3 px-3 text-sm text-slate-700">{item.ItemDescription}</td>
                                        <td className="py-3 px-3 text-sm text-slate-700">{item.QuantityDelivered}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-slate-900">New Items to Add</h2>
                            <button
                                type="button"
                                onClick={() => setIsItemModalOpen(true)}
                                disabled={finalizeDr || isSaving}
                                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Plus className="w-4 h-4" />
                                Add Item
                            </button>
                        </div>

                        {finalizeDr && (
                            <p className="mb-4 text-sm text-slate-500">
                                Finalize DR is checked. Uncheck it to add more items before saving.
                            </p>
                        )}

                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200">
                                        <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">#</th>
                                        <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">Article</th>
                                        <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">Description</th>
                                        <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">Qty</th>
                                        <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">Unit Cost</th>
                                        <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {fields.map((field, index) => (
                                        <tr key={field.id} className="border-b border-slate-100">
                                            <td className="py-3 px-3 text-sm text-slate-600">{index + 1}</td>
                                            <td className="py-3 px-3 text-sm text-slate-700">
                                                {articles.find((a) => a.id === details[index]?.article_id)?.name || '—'}
                                            </td>
                                            <td className="py-3 px-3 text-sm text-slate-700">{details[index]?.item_description || '—'}</td>
                                            <td className="py-3 px-3 text-sm text-slate-700">{details[index]?.quantity_delivered ?? 0}</td>
                                            <td className="py-3 px-3 text-sm text-slate-700">
                                                ₱{(details[index]?.unit_cost ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="py-3 px-3 text-sm text-slate-700">
                                                ₱{((details[index]?.quantity_delivered || 0) * (details[index]?.unit_cost || 0)).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {!finalizeDr && fields.length === 0 ? (
                            <div className="p-6 text-center text-sm text-slate-500 italic">No new items added yet.</div>
                        ) : errors.details && (
                            <p className="mt-4 text-sm text-red-600 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {errors.details.message}
                            </p>
                        )}
                    </div>

                    <ItemDetailsModal
                        open={isItemModalOpen}
                        onOpenChange={setIsItemModalOpen}
                        initialValues={{}}
                        articles={articles}
                        propertyTypes={propertyTypes}
                        units={units}
                        onSave={handleSaveItem}
                        existingSerials={Array.from(new Set([
                            ...usedSerials,
                            ...(dr.details || []).flatMap((item) => String(item.SerialNumber || '').split(',').map((s) => s.trim()).filter(Boolean)),
                            ...(details || []).flatMap((item) => String(item?.serial_number || '').split(',').map((s) => s.trim()).filter(Boolean)),
                        ]))}
                    />

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                        {fields.length > 0 && (
                            <div className="flex items-center justify-between text-lg">
                                <span className="text-slate-600">New Items Total:</span>
                                <span className="font-bold text-slate-900">
                                    ₱{totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        )}
                        <div className={fields.length > 0 ? 'pt-4 border-t border-slate-100' : ''}>
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    {...register('finalize_dr')}
                                    disabled={isSaving}
                                    className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600/20 disabled:opacity-50"
                                />
                                <span>
                                    <span className="block text-sm font-medium text-slate-900">Finalize DR</span>
                                    <span className="block text-sm text-slate-500 mt-1">
                                        Mark this delivery receipt as complete. Removes Partial status permanently and prevents adding more items.
                                    </span>
                                </span>
                            </label>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                            disabled={isSaving}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving || (!finalizeDr && fields.length === 0)}
                            className={`inline-flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed ${finalizeDr ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-[var(--primary)] hover:bg-[var(--primary)]/90'}`}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Saving...
                                </>
                            ) : finalizeDr ? (
                                <>
                                    <Save className="w-4 h-4" />
                                    {fields.length > 0 ? 'Save Items & Finalize DR' : 'Finalize DR'}
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Save Items
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

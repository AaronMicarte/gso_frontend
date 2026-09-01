'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, Plus, AlertCircle, Loader2, Edit3, Trash2, CheckCircle2, Hash } from 'lucide-react';
import { useForm, useFieldArray, Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { ItemDetailsModal } from './ItemDetailsModal';
import { useAllUnitsOfMeasure } from '@/lib/hooks/masterData/useUnitsOfMeasure';
import { useAddDeliveryReceiptItems, useFinalizeDeliveryReceipt, deliveryReceiptKeys } from '@/lib/hooks/useDeliveryReceipts';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { getDeliveryReceipt, getPropertyTypes, getUsedSerialNumbers } from '@/lib/api/deliveryReceipts';
import { getActiveArticles } from '@/lib/api/masterData';
import { Article } from '@/types/masterData';
import { DeliveryReceipt, DeliveryReceiptDetail } from '@/types/procurement';

const drItemSchema = z.object({
    dr_detail_id: z.number().optional(),
    article_id: z.number().min(1, 'Article is required'),
    item_description: z.string().max(1000, 'Item description is too long').optional().or(z.literal('')),
    brand: z.string().max(100, 'Brand is too long').optional().or(z.literal('')),
    model_number: z.string().max(100, 'Model number is too long').optional().or(z.literal('')),
    serial_number: z.string().max(1000, 'Serial number is too long').optional().or(z.literal('')),
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
    }
});

const addItemsSchema = z.object({
    new_items: z.array(drItemSchema),
    finalize_dr: z.boolean().optional(),
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
    const queryClient = useQueryClient();
    const drId = parseInt(params.id as string, 10);
    const addItemsMutation = useAddDeliveryReceiptItems();
    const finalizeMutation = useFinalizeDeliveryReceipt();
    const { showConfirmDialog, ConfirmDialog } = useConfirmDialog();

    const [dr, setDr] = useState<DeliveryReceipt | null>(null);
    const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>([]);
    const [articles, setArticles] = useState<Article[]>([]);
    const [usedSerials, setUsedSerials] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // In-place existing items state (and which ones were modified)
    const [existingItems, setExistingItems] = useState<DeliveryReceiptDetail[]>([]);
    const [modifiedDetailIds, setModifiedDetailIds] = useState<Set<number>>(new Set());

    // Modal state
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [modalInitialValues, setModalInitialValues] = useState<Partial<z.infer<typeof drItemSchema>>>({});
    const [modalMode, setModalMode] = useState<'create_new' | 'edit_new' | 'edit_existing'>('create_new');
    const [targetExistingDetailId, setTargetExistingDetailId] = useState<number | null>(null);
    const [targetNewItemIndex, setTargetNewItemIndex] = useState<number | null>(null);

    const {
        control,
        register,
        handleSubmit,
        watch,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<AddItemsFormValues>({
        resolver: zodResolver(addItemsSchema),
        defaultValues: { new_items: [], finalize_dr: false },
    });

    const { fields: newFields, append: appendNewItem, update: updateNewItem, remove: removeNewItem } = useFieldArray({
        control,
        name: 'new_items',
    });

    const newItems = watch('new_items');
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
                    getUsedSerialNumbers(drId),
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
                setExistingItems(drData.details || []);
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

    // Open modal to add a brand new item
    const handleOpenAddNewItem = () => {
        setModalMode('create_new');
        setTargetExistingDetailId(null);
        setTargetNewItemIndex(null);
        setModalInitialValues({
            dr_detail_id: undefined,
            article_id: 0,
            item_description: '',
            brand: '',
            model_number: '',
            serial_number: '',
            property_type_id: 0,
            unit_of_measure_id: 1,
            quantity_delivered: 1,
            quantity_requested: 1,
            change_reason: '',
            unit_cost: 0,
        });
        setIsItemModalOpen(true);
    };

    // Open modal to edit an existing item directly in place
    const handleOpenEditExistingItem = (item: DeliveryReceiptDetail) => {
        if (!item.DRDetailID) return;
        setModalMode('edit_existing');
        setTargetExistingDetailId(item.DRDetailID);
        setTargetNewItemIndex(null);
        setModalInitialValues({
            dr_detail_id: item.DRDetailID,
            article_id: item.ArticleID || (item.article as { ArticleID?: number })?.ArticleID || 0,
            item_description: item.ItemDescription || '',
            brand: item.Brand || '',
            model_number: item.ModelNumber || '',
            serial_number: item.SerialNumber || '',
            property_type_id: item.PropertyTypeID || 0,
            unit_of_measure_id: item.UnitOfMeasureID || 1,
            quantity_delivered: item.QuantityDelivered || 1,
            quantity_requested: item.QuantityRequested || item.QuantityDelivered || 1,
            change_reason: item.ChangeReason || '',
            unit_cost: typeof item.UnitCost === 'number' ? item.UnitCost : parseFloat(String(item.UnitCost || 0)),
        });
        setIsItemModalOpen(true);
    };

    // Open modal to edit a newly added item before submission
    const handleOpenEditNewItem = (index: number) => {
        setModalMode('edit_new');
        setTargetExistingDetailId(null);
        setTargetNewItemIndex(index);
        setModalInitialValues(newItems[index]);
        setIsItemModalOpen(true);
    };

    // Modal save handler
    const handleModalSave = async (values: z.infer<typeof drItemSchema>) => {
        if (modalMode === 'edit_existing' && targetExistingDetailId !== null) {
            // Update the existing item directly in the existingItems array
            setExistingItems((prev) =>
                prev.map((item) => {
                    if (item.DRDetailID === targetExistingDetailId) {
                        const matchedArticle = articles.find((a) => a.id === values.article_id);
                        return {
                            ...item,
                            ArticleID: values.article_id,
                            ItemDescription: values.item_description || '',
                            Brand: values.brand || '',
                            ModelNumber: values.model_number || '',
                            SerialNumber: values.serial_number || '',
                            PropertyTypeID: values.property_type_id,
                            UnitOfMeasureID: values.unit_of_measure_id,
                            QuantityDelivered: values.quantity_delivered,
                            QuantityRequested: values.quantity_requested,
                            ChangeReason: values.change_reason || '',
                            UnitCost: values.unit_cost,
                            TotalCost: values.quantity_delivered * values.unit_cost,
                            article: matchedArticle
                                ? { ArticleID: matchedArticle.id, ArticleName: matchedArticle.name }
                                : item.article,
                        };
                    }
                    return item;
                })
            );

            // Mark this detail as modified
            setModifiedDetailIds((prev) => new Set(prev).add(targetExistingDetailId));
            toast.success('Existing item updated in-place');
        } else if (modalMode === 'edit_new' && targetNewItemIndex !== null) {
            // Update row in new_items form array
            updateNewItem(targetNewItemIndex, values);
        } else {
            // Append as a new item
            appendNewItem(values);
        }

        setIsItemModalOpen(false);
    };

    const submitForm = async (data: AddItemsFormValues) => {
        // Collect modified existing items
        const modifiedExistingPayload = existingItems
            .filter((item): item is DeliveryReceiptDetail & { DRDetailID: number } => !!item.DRDetailID && modifiedDetailIds.has(item.DRDetailID))
            .map((item) => ({
                dr_detail_id: item.DRDetailID,
                article_id: item.ArticleID,
                item_description: item.ItemDescription,
                brand: item.Brand || '',
                model_number: item.ModelNumber || '',
                serial_number: item.SerialNumber || '',
                property_type_id: item.PropertyTypeID,
                unit_of_measure_id: item.UnitOfMeasureID,
                quantity_delivered: item.QuantityDelivered,
                quantity_requested: item.QuantityRequested || item.QuantityDelivered,
                change_reason: item.ChangeReason || '',
                unit_cost: typeof item.UnitCost === 'number' ? item.UnitCost : parseFloat(String(item.UnitCost || 0)),
            }));

        const newItemsPayload = data.new_items || [];
        const allPayloadDetails = [...modifiedExistingPayload, ...newItemsPayload];

        if (allPayloadDetails.length === 0 && !data.finalize_dr) {
            toast.error('Please adjust an existing item, add a new item, or check Finalize DR.');
            return;
        }

        try {
            if (allPayloadDetails.length > 0) {
                await addItemsMutation.mutateAsync({
                    id: drId,
                    details: allPayloadDetails as unknown as Record<string, unknown>[],
                    finalize_dr: data.finalize_dr === true,
                });
                toast.success(data.finalize_dr
                    ? 'Changes saved and delivery receipt finalized successfully'
                    : 'Changes saved successfully');
            } else if (data.finalize_dr) {
                await finalizeMutation.mutateAsync(drId);
                toast.success('Delivery receipt finalized successfully');
            }

            await queryClient.invalidateQueries({ queryKey: deliveryReceiptKeys.all });
            await queryClient.refetchQueries({ queryKey: deliveryReceiptKeys.all });

            router.push(`${baseRoute}/delivery-receipts`);
            router.refresh();
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
                description: 'This will permanently mark the delivery receipt as complete. No more items can be added after finalizing. Issued items will remain issued.',
                confirmText: 'Finalize DR',
                onConfirm: () => submitForm(data),
            });
            return;
        }

        await submitForm(data);
    };

    const totalNewAmount = newItems?.reduce((sum, item) => sum + (item.quantity_delivered * (item.unit_cost || 0)), 0) || 0;
    const hasAnyPendingChanges = modifiedDetailIds.size > 0 || newFields.length > 0;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
            </div>
        );
    }

    if (!dr) {
        return null;
    }

    return (
        <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: 'fixed' }}>
            <ConfirmDialog />
            <div className="p-6 max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                        type="button"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Add & Adjust Items on Delivery Receipt</h1>
                        <p className="text-slate-500 text-sm">DR Number: {dr.DRNumber}</p>
                    </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                    This delivery receipt is partial. You can adjust delivered quantities and serial numbers on existing items below, or add new items to the delivery receipt.
                </div>

                {/* 1. EXISTING ITEMS ON DR (IN-PLACE EDIT / ADJUST) */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">Existing Items on DR</h2>
                            <p className="text-xs text-slate-500">Edit or adjust quantities and serial numbers for items already in this delivery.</p>
                        </div>
                        {modifiedDetailIds.size > 0 && (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {modifiedDetailIds.size} item(s) modified
                            </span>
                        )}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/50">
                                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-600">#</th>
                                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-600">Article</th>
                                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-600">Description</th>
                                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-600">Brand / Model</th>
                                    <th className="text-center py-2.5 px-3 text-xs font-semibold text-slate-600">Delivered</th>
                                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-600">Serial Numbers</th>
                                    <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-600">Unit Cost</th>
                                    <th className="text-center py-2.5 px-3 text-xs font-semibold text-slate-600">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {existingItems.map((item, index) => {
                                    const isModified = !!item.DRDetailID && modifiedDetailIds.has(item.DRDetailID);
                                    const serialList = String(item.SerialNumber || '')
                                        .split(',')
                                        .map((s) => s.trim())
                                        .filter(Boolean);

                                    return (
                                        <tr key={item.DRDetailID} className={`border-b border-slate-100 hover:bg-slate-50/70 transition-colors ${isModified ? 'bg-blue-50/50' : ''}`}>
                                            <td className="py-3 px-3 text-sm text-slate-600">{index + 1}</td>
                                            <td className="py-3 px-3 text-sm font-medium text-slate-800">
                                                {item.article?.ArticleName || '—'}
                                            </td>
                                            <td className="py-3 px-3 text-sm text-slate-700">
                                                <span>{item.ItemDescription}</span>
                                                {isModified && (
                                                    <span className="ml-2 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold">
                                                        Modified
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-3 text-xs text-slate-600">
                                                {[item.Brand, item.ModelNumber].filter(Boolean).join(' - ') || '—'}
                                            </td>
                                            <td className="py-3 px-3 text-sm text-center font-semibold text-slate-800">
                                                {item.QuantityDelivered}
                                            </td>
                                            <td className="py-3 px-3 text-xs text-slate-600 max-w-[200px]">
                                                {serialList.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {serialList.map((sn, snIdx) => (
                                                            <span key={snIdx} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-mono">
                                                                <Hash className="w-2.5 h-2.5 text-slate-400" />
                                                                {sn}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 italic">None</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-3 text-sm text-right text-slate-700">
                                                ₱{(parseFloat(String(item.UnitCost || 0))).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="py-3 px-3 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenEditExistingItem(item)}
                                                    disabled={finalizeDr || isSaving}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[var(--primary)] bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                                                >
                                                    <Edit3 className="w-3.5 h-3.5" />
                                                    {isModified ? 'Edit Again' : 'Edit / Adjust'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 2. ADD NEW ITEMS SECTION (SEPARATE NEW ROWS) */}
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">Add New Items to DR</h2>
                                <p className="text-xs text-slate-500">Add brand-new product lines that were not originally on this delivery receipt.</p>
                            </div>
                            <button
                                type="button"
                                onClick={handleOpenAddNewItem}
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
                                    <tr className="border-b border-slate-200 bg-slate-50/50">
                                        <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-600">#</th>
                                        <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-600">Article</th>
                                        <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-600">Description</th>
                                        <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-600">Brand / Model</th>
                                        <th className="text-center py-2.5 px-3 text-xs font-semibold text-slate-600">Qty Delivered</th>
                                        <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-600">Serial Numbers</th>
                                        <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-600">Unit Cost</th>
                                        <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-600">Total</th>
                                        <th className="text-center py-2.5 px-3 text-xs font-semibold text-slate-600">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {newFields.map((field, index) => {
                                        const articleObj = articles.find((a) => a.id === newItems[index]?.article_id);
                                        const serialList = String(newItems[index]?.serial_number || '')
                                            .split(',')
                                            .map((s) => s.trim())
                                            .filter(Boolean);

                                        return (
                                            <tr key={field.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                                                <td className="py-3 px-3 text-sm text-slate-600">{index + 1}</td>
                                                <td className="py-3 px-3 text-sm font-medium text-slate-800">
                                                    {articleObj?.name || '—'}
                                                </td>
                                                <td className="py-3 px-3 text-sm text-slate-700">{newItems[index]?.item_description || '—'}</td>
                                                <td className="py-3 px-3 text-xs text-slate-600">
                                                    {[newItems[index]?.brand, newItems[index]?.model_number].filter(Boolean).join(' - ') || '—'}
                                                </td>
                                                <td className="py-3 px-3 text-sm text-center font-semibold text-slate-800">
                                                    {newItems[index]?.quantity_delivered ?? 0}
                                                </td>
                                                <td className="py-3 px-3 text-xs text-slate-600 max-w-[200px]">
                                                    {serialList.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {serialList.map((sn, snIdx) => (
                                                                <span key={snIdx} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-mono border border-emerald-200">
                                                                    <Hash className="w-2.5 h-2.5 text-emerald-500" />
                                                                    {sn}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 italic">None</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-3 text-sm text-right text-slate-700">
                                                    ₱{(newItems[index]?.unit_cost ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="py-3 px-3 text-sm text-right font-medium text-slate-900">
                                                    ₱{((newItems[index]?.quantity_delivered || 0) * (newItems[index]?.unit_cost || 0)).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="py-3 px-3 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenEditNewItem(index)}
                                                            disabled={isSaving}
                                                            className="p-1 text-slate-600 hover:text-[var(--primary)] transition-colors"
                                                            title="Edit Details"
                                                        >
                                                            <Edit3 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeNewItem(index)}
                                                            disabled={isSaving}
                                                            className="p-1 text-red-500 hover:text-red-700 transition-colors"
                                                            title="Remove"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {newFields.length === 0 && (
                            <div className="p-6 text-center text-sm text-slate-500 italic">
                                No new items added yet. Click &quot;Add Item&quot; above to append a new item.
                            </div>
                        )}

                        {errors.new_items && (
                            <p className="mt-4 text-sm text-red-600 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {errors.new_items.message}
                            </p>
                        )}
                    </div>

                    {/* Shared Item Details Modal */}
                    <ItemDetailsModal
                        open={isItemModalOpen}
                        onOpenChange={setIsItemModalOpen}
                        initialValues={modalInitialValues}
                        articles={articles}
                        propertyTypes={propertyTypes}
                        units={units}
                        onSave={handleModalSave}
                        existingSerials={Array.from(new Set([
                            ...usedSerials,
                            ...existingItems.flatMap((item) => String(item.SerialNumber || '').split(',').map((s) => s.trim()).filter(Boolean)),
                            ...(newItems || []).flatMap((item) => String(item?.serial_number || '').split(',').map((s) => s.trim()).filter(Boolean)),
                        ]))}
                    />

                    {/* Bottom Summary & Finalize */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                        {newFields.length > 0 && (
                            <div className="flex items-center justify-between text-base">
                                <span className="text-slate-600">Total for New Items:</span>
                                <span className="font-bold text-slate-900">
                                    ₱{totalNewAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        )}
                        <div className={newFields.length > 0 ? 'pt-4 border-t border-slate-100' : ''}>
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

                    {/* Action Buttons */}
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
                            disabled={isSaving || (!finalizeDr && !hasAnyPendingChanges)}
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
                                    {hasAnyPendingChanges ? 'Save Changes & Finalize DR' : 'Finalize DR'}
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

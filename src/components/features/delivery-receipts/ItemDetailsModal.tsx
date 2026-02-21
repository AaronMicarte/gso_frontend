'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';
import { Package, Hash, Calculator } from 'lucide-react';

const itemSchema = z.object({
    article_id: z.number().int().min(1, 'Article is required'),
    item_description: z.string().max(1000, 'Item description is too long').optional().or(z.literal('')),
    brand: z.string().optional(),
    model_number: z.string().optional(),
    serial_number: z.string().optional(),
    property_type_id: z.number().int().min(1, 'Property type is required'),
    unit_of_measure_id: z.number().int().min(1, 'Unit is required'),
    quantity_delivered: z.number().int().min(1, 'Quantity must be at least 1'),
    unit_cost: z.number().min(0),
}).superRefine((data, ctx) => {
    const serial = data.serial_number?.trim();
    if (serial && data.quantity_delivered > 1) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['quantity_delivered'],
            message: 'Quantity must be 1 when a serial number is provided',
        });
    }
});

export type ItemFormValues = z.infer<typeof itemSchema>;

interface ItemDetailsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialValues: Partial<ItemFormValues>;
    articles: { id: number; name: string; property_type_id: number; default_unit_of_measure_id: number }[];
    propertyTypes: { PropertyTypeID: number; PropertyName: string }[];
    units: { id: number; name: string }[];
    onSave: (values: ItemFormValues) => Promise<void> | void;
    loading?: boolean;
}

export function ItemDetailsModal({ open, onOpenChange, initialValues, articles, propertyTypes, units, onSave, loading = false }: ItemDetailsModalProps) {
    const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<ItemFormValues>({
        resolver: zodResolver(itemSchema),
        defaultValues: {
            article_id: 0,
            item_description: '',
            brand: '',
            model_number: '',
            serial_number: '',
            property_type_id: 0,
            unit_of_measure_id: 1,
            quantity_delivered: 1,
            unit_cost: 0,
            ...initialValues,
        }
    });

    const quantity = watch('quantity_delivered');
    const unitCost = watch('unit_cost');
    const selectedArticleId = watch('article_id');
    const currentPropertyTypeId = watch('property_type_id');
    const currentUnitId = watch('unit_of_measure_id');
    const totalCost = (quantity || 0) * (unitCost || 0);

    // Lock quantity when a serial number is provided
    const serialNumber = watch('serial_number');
    const isSerialProvided = Boolean(serialNumber && String(serialNumber).trim().length > 0);

    // If serial number exists, force quantity to 1 and validate
    useEffect(() => {
        if (isSerialProvided) {
            setValue('quantity_delivered', 1, { shouldValidate: true, shouldDirty: true });
        }
    }, [isSerialProvided, setValue]);

    // Use ref to track previous open state
    const prevOpenRef = useRef(open);

    // Article combobox state & refs (searchable)
    const [articleQuery, setArticleQuery] = useState('');
    const [articleOpen, setArticleOpen] = useState(false);
    const [articleHighlightedIndex, setArticleHighlightedIndex] = useState(-1);
    const articleComboboxRef = useRef<HTMLDivElement | null>(null);
    const articleComboboxInputRef = useRef<HTMLInputElement | null>(null);
    const articleComboboxListRef = useRef<HTMLUListElement | null>(null);

    const filteredArticles = articles.filter(a => a.name.toLowerCase().includes(articleQuery.trim().toLowerCase()));

    const [articleTouched, setArticleTouched] = useState(false);

    const selectArticle = (a: { id: number; name: string; property_type_id: number; default_unit_of_measure_id: number }) => {
        setArticleQuery(a.name);
        setValue('article_id', a.id);
        setValue('property_type_id', a.property_type_id, { shouldValidate: true, shouldDirty: true });
        setValue('unit_of_measure_id', a.default_unit_of_measure_id, { shouldValidate: true, shouldDirty: true });
        setArticleTouched(true);
        setArticleOpen(false);
        setArticleHighlightedIndex(-1);
    };

    const handleArticleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setArticleHighlightedIndex(prev => Math.min(prev + 1, filteredArticles.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setArticleHighlightedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (articleHighlightedIndex >= 0 && articleHighlightedIndex < filteredArticles.length) {
                selectArticle(filteredArticles[articleHighlightedIndex]);
            } else if (filteredArticles.length === 1) {
                selectArticle(filteredArticles[0]);
            }
        } else if (e.key === 'Tab') {
            if (articleQuery.trim() && filteredArticles.length > 0) {
                if (articleHighlightedIndex >= 0 && articleHighlightedIndex < filteredArticles.length) {
                    selectArticle(filteredArticles[articleHighlightedIndex]);
                } else {
                    selectArticle(filteredArticles[0]);
                }
            }
        } else if (e.key === 'Escape') {
            setArticleOpen(false);
        }
    };

    // Close combobox when clicking outside
    useEffect(() => {
        function handleDocClick(e: MouseEvent) {
            if (articleComboboxRef.current && !articleComboboxRef.current.contains(e.target as Node)) {
                setArticleOpen(false);
                setArticleHighlightedIndex(-1);
            }
        }
        document.addEventListener('mousedown', handleDocClick);
        return () => document.removeEventListener('mousedown', handleDocClick);
    }, [articleComboboxRef]);

    React.useEffect(() => {
        // Only reset when modal opens (transitions from false to true)
        if (open && !prevOpenRef.current) {
            reset({
                ...initialValues,
                item_description: initialValues.item_description && initialValues.item_description !== '0' ? initialValues.item_description : '',
                brand: initialValues.brand && initialValues.brand !== '0' ? initialValues.brand : '',
                model_number: initialValues.model_number && initialValues.model_number !== '0' ? initialValues.model_number : '',
                serial_number: initialValues.serial_number && initialValues.serial_number !== '0' ? initialValues.serial_number : '',
            });

            // prefill article query from initialValues.article_id when editing
            if (initialValues?.article_id) {
                const found = articles.find(a => a.id === initialValues.article_id);
                setArticleQuery(found?.name || '');
                setValue('article_id', initialValues.article_id as number);
            } else {
                setArticleQuery('');
                setValue('article_id', 0);
            }
            setArticleTouched(false);
        }
        prevOpenRef.current = open;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, initialValues, articles]);

    useEffect(() => {
        if (!selectedArticleId) return;
        const article = articles.find(a => a.id === selectedArticleId);
        if (!article) return;

        if (articleTouched || !currentPropertyTypeId) {
            setValue('property_type_id', article.property_type_id, { shouldValidate: true, shouldDirty: true });
        }

        if (articleTouched || !currentUnitId) {
            setValue('unit_of_measure_id', article.default_unit_of_measure_id, { shouldValidate: true, shouldDirty: true });
        }
    }, [selectedArticleId, articleTouched, currentPropertyTypeId, currentUnitId, articles, setValue]);

    const submit = handleSubmit(async (data) => {
        try {
            await onSave(data);
            toast.success('Item saved successfully');
            onOpenChange(false);
        } catch (e) {
            toast.error('Failed to save item');
            console.error(e);
        }
    });

    return (
        <Dialog
            title="Item Details"
            description="Configure the delivered item specifications"
            open={open}
            onOpenChange={onOpenChange}
            onConfirm={submit}
            confirmText="Save Item"
            cancelText="Cancel"
            loading={loading}
            contentClassName="w-[95vw] md:w-[900px] lg:w-[1100px] !max-w-none max-h-[90vh] overflow-y-auto"
        >
            <div className="space-y-6">
                {/* Article Selection (searchable) */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-[var(--primary)]" />
                        <label className="text-sm font-semibold text-slate-900">Article Type</label>
                    </div>

                    <div className="relative" ref={articleComboboxRef}>
                        <input
                            ref={articleComboboxInputRef}
                            type="text"
                            role="combobox"
                            aria-expanded={articleOpen}
                            aria-controls="article-listbox"
                            aria-autocomplete="list"
                            value={articleQuery}
                            onChange={(e) => {
                                setArticleQuery(e.target.value);
                                setArticleOpen(true);
                                setArticleHighlightedIndex(-1);
                                setValue('article_id', 0);
                            }}
                            onKeyDown={handleArticleKeyDown}
                            placeholder="Search article types..."
                            className="w-full px-4 py-2.5 bg-white border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-all duration-200"
                            onFocus={() => setArticleOpen(true)}
                        />

                        {/* hidden numeric value bound to form */}
                        <input type="hidden" {...register('article_id', { valueAsNumber: true })} />

                        {articleOpen && (
                            <ul id="article-listbox" role="listbox" ref={articleComboboxListRef} className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded shadow-sm max-h-48 overflow-auto">
                                {filteredArticles.length === 0 ? (
                                    <li className="px-3 py-2 text-sm text-slate-500">No articles found</li>
                                ) : (
                                    filteredArticles.map((a, idx) => (
                                        <li
                                            key={a.id}
                                            role="option"
                                            aria-selected={articleHighlightedIndex === idx}
                                            onMouseDown={(e) => { e.preventDefault(); selectArticle(a); }}
                                            onMouseEnter={() => setArticleHighlightedIndex(idx)}
                                            className={`px-3 py-2 text-sm cursor-pointer ${articleHighlightedIndex === idx ? 'bg-[var(--primary)] text-white' : 'hover:bg-slate-100'}`}
                                        >
                                            {a.name}
                                        </li>
                                    ))
                                )}
                            </ul>
                        )}
                    </div>

                    {errors.article_id && (
                        <p className="text-sm text-red-600">{errors.article_id.message}</p>
                    )}
                </div>

                {/* Item Description */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-[var(--primary)]" />
                        <label className="text-sm font-semibold text-slate-900">Item Description</label>
                    </div>
                    <Input
                        {...register('item_description')}
                        placeholder="Enter item description"
                        error={errors.item_description?.message}
                    />
                </div>

                {/* Property Type & Unit of Measure */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-900">Property Type</label>
                        <select
                            {...register('property_type_id', { valueAsNumber: true })}
                            disabled
                            className="w-full px-4 py-2.5 bg-white border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-all duration-200"
                        >
                            <option value={0}>Select property type...</option>
                            {propertyTypes.map(pt => (
                                <option key={pt.PropertyTypeID} value={pt.PropertyTypeID}>{pt.PropertyName}</option>
                            ))}
                        </select>
                        <p className="text-xs text-slate-500">Property type is locked to the selected article.</p>
                        {errors.property_type_id && (
                            <p className="text-sm text-[var(--error)]">{errors.property_type_id.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-900">Unit of Measure</label>
                        <select
                            {...register('unit_of_measure_id', { valueAsNumber: true })}
                            className="w-full px-4 py-2.5 bg-white border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-all duration-200"
                        >
                            {units.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Equipment Details - optional */}
                <div className="space-y-4">
                    <div className="border-t border-slate-200 pt-4">
                        <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                            <Hash className="w-4 h-4 text-[var(--primary)]" />
                            Equipment Specifications (Optional)
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input
                                {...register('brand')}
                                label="Brand"
                                placeholder="e.g., Dell, HP"
                            />
                            <Input
                                {...register('model_number')}
                                label="Model Number"
                                placeholder="e.g., OptiPlex 7090"
                            />
                            <div>
                                <Input
                                    {...register('serial_number')}
                                    label="Serial Number"
                                    placeholder="e.g., SN123456789"
                                />
                                <p className="mt-1 text-xs text-slate-500">
                                    {isSerialProvided ? 'Serial entered — quantity locked to 1.' : 'If you enter a serial number, quantity will be locked to 1.'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quantity & Cost */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-900">Quantity Delivered</label>
                        <Input
                            {...register('quantity_delivered', { valueAsNumber: true })}
                            type="number"
                            min={1}
                            placeholder="Enter quantity"
                            error={errors.quantity_delivered?.message}
                            disabled={isSerialProvided}
                            className={isSerialProvided ? 'opacity-60' : ''}
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-semibold text-slate-900">Unit Cost (₱)</label>
                        </div>
                        <Input
                            {...register('unit_cost', { valueAsNumber: true })}
                            type="number"
                            step="0.01"
                            min={0}
                            placeholder="0.00"
                            error={errors.unit_cost?.message}
                        />
                    </div>
                </div>

                {/* Total Cost Display */}
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Calculator className="w-4 h-4 text-[var(--primary)]" />
                            <span className="text-sm font-semibold text-slate-900">Total Cost</span>
                        </div>
                        <span className="text-lg font-bold text-[var(--primary)]">
                            ₱{totalCost.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}
                        </span>
                    </div>
                </div>
            </div>
        </Dialog>
    );
}

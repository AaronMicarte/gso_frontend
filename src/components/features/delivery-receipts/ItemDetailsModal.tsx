'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { ArticlePreviewModal } from '@/components/ui/ArticlePreviewModal';
import { toast } from 'sonner';
import { Package, Calculator, Hash } from 'lucide-react';

const itemSchema = z.object({
    article_id: z.number().int().min(1, 'Article is required'),
    item_description: z.string().max(1000, 'Item description is too long').optional().or(z.literal('')),
    brand: z.string().max(100, 'Brand is too long').optional().or(z.literal('')),
    model_number: z.string().max(100, 'Model number is too long').optional().or(z.literal('')),
    serial_number: z.string().max(1000, 'Serial number is too long').optional().or(z.literal('')),
    property_type_id: z.number().int().min(1, 'Property type is required'),
    unit_of_measure_id: z.number().int().min(1, 'Unit is required'),
    quantity_delivered: z.number().int().min(1, 'Quantity must be at least 1'),
    quantity_requested: z.number().int().min(1, 'Quantity must be at least 1'),
    change_reason: z.string().optional(),
    unit_cost: z.number().min(0, 'Unit cost cannot be negative'),
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
});

export type ItemFormValues = z.infer<typeof itemSchema>;

interface ItemDetailsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialValues: Partial<ItemFormValues>;
    articles: { id: number; name: string; property_type_id: number; default_unit_of_measure_id: number; image_url?: string | null }[];
    propertyTypes: { PropertyTypeID: number; PropertyName: string }[];
    units: { id: number; name: string }[];
    onSave: (values: ItemFormValues) => Promise<void> | void;
    loading?: boolean;
    existingSerials?: string[];
}

export function ItemDetailsModal({
    open,
    onOpenChange,
    initialValues,
    articles,
    propertyTypes,
    units,
    onSave,
    loading = false,
    existingSerials = [],
}: ItemDetailsModalProps) {
    const { register, handleSubmit, formState: { errors }, reset, watch, setValue, setError, clearErrors } = useForm<ItemFormValues>({
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
            quantity_requested: 1,
            change_reason: '',
            unit_cost: 0,
            ...initialValues,
        }
    });

    const quantity = watch('quantity_delivered');
    const requested = watch('quantity_requested');
    const unitCost = watch('unit_cost');
    const selectedArticleId = watch('article_id');
    const currentPropertyTypeId = watch('property_type_id');
    const currentUnitId = watch('unit_of_measure_id');
    const totalCost = (requested || 0) * (unitCost || 0);

    const selectedArticle = articles.find((a) => a.id === selectedArticleId) || null;
    const [isArticleModalOpen, setIsArticleModalOpen] = useState(false);
    const [articleModalUrl, setArticleModalUrl] = useState<string | null>(null);

    // Serial number toggle state: true = With Serial Number, false = No Serial Number
    const [hasSerialToggle, setHasSerialToggle] = useState<boolean>(() => {
        const raw = String(initialValues.serial_number ?? '').trim();
        return raw.length > 0;
    });

    // Array of serial number inputs for each item unit
    const [serials, setSerials] = useState<string[]>([]);
    const [serialErrors, setSerialErrors] = useState<{ [key: number]: string }>({});

    const resolveArticleImageUrl = (article: { image_url?: string | null; image_path?: string | null }): string | null => {
        const raw = article.image_url || article.image_path || '';
        if (!raw) return null;
        if (raw.startsWith('http') || raw.startsWith('//') || raw.startsWith('/')) return raw;
        if (raw.startsWith('data:')) return raw;
        return `/${raw}`;
    };

    // Ref to track previous open state
    const prevOpenRef = useRef(open);

    // Article combobox state & refs
    const [articleQuery, setArticleQuery] = useState('');
    const [articleOpen, setArticleOpen] = useState(false);
    const [articleHighlightedIndex, setArticleHighlightedIndex] = useState(-1);
    const articleComboboxRef = useRef<HTMLDivElement | null>(null);
    const articleComboboxInputRef = useRef<HTMLInputElement | null>(null);

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

    useEffect(() => {
        function handleDocClick(e: MouseEvent) {
            if (articleComboboxRef.current && !articleComboboxRef.current.contains(e.target as Node)) {
                setArticleOpen(false);
                setArticleHighlightedIndex(-1);
            }
        }
        document.addEventListener('mousedown', handleDocClick);
        return () => document.removeEventListener('mousedown', handleDocClick);
    }, []);

    // When modal opens, reset form values and toggle state
    useEffect(() => {
        if (open && !prevOpenRef.current) {
            reset({
                ...initialValues,
                item_description: initialValues.item_description && initialValues.item_description !== '0' ? initialValues.item_description : '',
                quantity_requested: initialValues.quantity_requested ?? initialValues.quantity_delivered ?? 1,
                quantity_delivered: initialValues.quantity_delivered ?? initialValues.quantity_requested ?? 1,
                change_reason: initialValues.change_reason ?? '',
            });

            if (initialValues?.article_id) {
                const found = articles.find(a => a.id === initialValues.article_id);
                setArticleQuery(found?.name || '');
                setValue('article_id', initialValues.article_id as number);
            } else {
                setArticleQuery('');
                setValue('article_id', 0);
            }

            const rawSerials = String(initialValues.serial_number ?? '').trim();
            const initialHasSerial = rawSerials.length > 0;
            setHasSerialToggle(initialHasSerial);

            const parsed = rawSerials.split(',').map(s => s.trim()).filter(Boolean);
            const targetQty = initialValues.quantity_requested ?? initialValues.quantity_delivered ?? 1;

            if (initialHasSerial) {
                const initialArr: string[] = [];
                for (let i = 0; i < targetQty; i++) {
                    initialArr.push(parsed[i] || '');
                }
                setSerials(initialArr);
            } else {
                setSerials([]);
            }

            setSerialErrors({});
            setArticleTouched(false);
            clearErrors('serial_number');
        }
        prevOpenRef.current = open;
    }, [open, initialValues, articles, reset, setValue, clearErrors]);

    // Keep quantity_delivered in sync with quantity_requested if not set
    useEffect(() => {
        if (requested && requested > 0 && quantity !== requested) {
            setValue('quantity_delivered', requested, { shouldValidate: true });
        }
    }, [requested, quantity, setValue]);

    // Keep PropertyType and Unit in sync with selected Article
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

    // Automatically adjust serial number fields count based on Quantity
    useEffect(() => {
        if (!hasSerialToggle) {
            setSerials([]);
            setValue('serial_number', '', { shouldValidate: true, shouldDirty: true });
            setSerialErrors({});
            clearErrors('serial_number');
            return;
        }

        const targetCount = Math.max(1, requested || 1);
        setSerials(prev => {
            if (prev.length === targetCount) return prev;
            const newArr = [...prev];
            if (newArr.length < targetCount) {
                while (newArr.length < targetCount) {
                    newArr.push('');
                }
            } else {
                newArr.length = targetCount;
            }
            return newArr;
        });
    }, [hasSerialToggle, requested, setValue, clearErrors]);

    // Sync form's serial_number field whenever serials array changes
    useEffect(() => {
        if (!hasSerialToggle) {
            setValue('serial_number', '', { shouldValidate: true, shouldDirty: true });
            return;
        }

        const joined = serials.map(s => s.trim()).join(',');
        setValue('serial_number', joined, { shouldValidate: true, shouldDirty: true });
    }, [serials, hasSerialToggle, setValue]);

    useEffect(() => {
        if (quantity === requested) {
            setValue('change_reason', '', { shouldValidate: true, shouldDirty: true });
        }
    }, [quantity, requested, setValue]);

    // Validate serial inputs for duplicates and existing serials
    const validateSerials = (): boolean => {
        if (!hasSerialToggle) {
            setSerialErrors({});
            clearErrors('serial_number');
            return true;
        }

        let valid = true;
        const errs: { [key: number]: string } = {};
        const lowerExisting = new Set(existingSerials.map(s => s.toLowerCase().trim()));
        const seenInModal = new Map<string, number>();

        serials.forEach((s, idx) => {
            const trimmed = s.trim();
            if (!trimmed) {
                errs[idx] = `Serial Number #${idx + 1} is required`;
                valid = false;
                return;
            }

            const lower = trimmed.toLowerCase();

            // Check duplicate inside this modal
            if (seenInModal.has(lower)) {
                errs[idx] = `Serial Number "${trimmed}" is duplicated in this item`;
                errs[seenInModal.get(lower)!] = `Serial Number "${trimmed}" is duplicated in this item`;
                valid = false;
            } else {
                seenInModal.set(lower, idx);
            }

            // Check against existing serial numbers in DB / other DR items
            if (lowerExisting.has(lower)) {
                errs[idx] = `Serial Number "${trimmed}" is already used in another DR`;
                valid = false;
            }
        });

        setSerialErrors(errs);

        if (!valid) {
            setError('serial_number', {
                type: 'custom',
                message: 'Please resolve invalid or duplicate serial numbers.',
            });
        } else {
            clearErrors('serial_number');
        }

        return valid;
    }

    const submit = handleSubmit(async (data) => {
        if (hasSerialToggle && !validateSerials()) {
            toast.error('Please fix serial number errors before saving.');
            return;
        }

        if (!hasSerialToggle) {
            data.serial_number = '';
        }

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
                {/* 1. Article Selection (searchable) */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-[var(--primary)]" />
                        <label className="text-sm font-semibold text-slate-900">Article Type *</label>
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

                        <input type="hidden" {...register('article_id', { valueAsNumber: true })} />

                        {articleOpen && (
                            <ul id="article-listbox" role="listbox" className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded shadow-sm max-h-48 overflow-auto">
                                {filteredArticles.length === 0 ? (
                                    <li className="px-3 py-2 text-sm text-slate-500">No articles found</li>
                                ) : (
                                    filteredArticles.map((a, idx) => {
                                        const imgUrl = resolveArticleImageUrl(a);
                                        return (
                                            <li
                                                key={a.id}
                                                role="option"
                                                aria-selected={articleHighlightedIndex === idx}
                                                onMouseDown={(e) => { e.preventDefault(); selectArticle(a); }}
                                                onMouseEnter={() => setArticleHighlightedIndex(idx)}
                                                className={`px-3 py-2 text-sm cursor-pointer ${articleHighlightedIndex === idx ? 'bg-[var(--primary)] text-white' : 'hover:bg-slate-100'}`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className="h-6 w-6 overflow-hidden rounded-sm border border-slate-200 bg-slate-100 flex-shrink-0">
                                                        {imgUrl ? (
                                                            <img src={imgUrl} alt={a.name} className="h-full w-full object-cover" />
                                                        ) : (
                                                            <span className="flex h-full w-full items-center justify-center text-[0.65rem] text-slate-400">N/A</span>
                                                        )}
                                                    </div>
                                                    <span>{a.name}</span>
                                                </div>
                                            </li>
                                        );
                                    })
                                )}
                            </ul>
                        )}
                    </div>

                    {errors.article_id && (
                        <p className="text-sm text-red-600">{errors.article_id.message}</p>
                    )}

                    {selectedArticle ? (
                        <>
                            <div
                                className="mt-3 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 cursor-pointer hover:bg-slate-100"
                                onClick={() => {
                                    const imgUrl = resolveArticleImageUrl(selectedArticle);
                                    if (imgUrl) {
                                        setArticleModalUrl(imgUrl);
                                        setIsArticleModalOpen(true);
                                    }
                                }}
                            >
                                <div className="h-16 w-16 overflow-hidden rounded-md border border-slate-200 bg-slate-100 flex-shrink-0">
                                    {resolveArticleImageUrl(selectedArticle) ? (
                                        <img
                                            src={resolveArticleImageUrl(selectedArticle) ?? ''}
                                            alt={selectedArticle.name}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">No image</div>
                                    )}
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-900">{selectedArticle.name}</p>
                                    <p className="text-xs text-slate-600">{resolveArticleImageUrl(selectedArticle) ? 'Click to enlarge' : 'No image available'}</p>
                                </div>
                            </div>

                            <ArticlePreviewModal
                                open={isArticleModalOpen && Boolean(articleModalUrl)}
                                onClose={() => setIsArticleModalOpen(false)}
                                imageUrl={articleModalUrl || ''}
                                alt={selectedArticle.name}
                            />
                        </>
                    ) : null}
                </div>

                {/* 2. Item Description */}
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

                {/* 3. Property Type (LOCKED / READ-ONLY) & Unit of Measure */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-900">Property Type</label>
                        <Input
                            value={propertyTypes.find(p => p.PropertyTypeID === currentPropertyTypeId)?.PropertyName || 'Select article to load type'}
                            readOnly
                            disabled
                            className="bg-slate-100 text-slate-700 font-medium cursor-not-allowed border-slate-300"
                        />
                        <input type="hidden" {...register('property_type_id', { valueAsNumber: true })} />
                        <p className="text-xs text-slate-500">Property type is locked to the selected article.</p>
                        {errors.property_type_id && (
                            <p className="text-sm text-red-600">{errors.property_type_id.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-900">Unit of Measure</label>
                        <Input
                            value={units.find(u => u.id === currentUnitId)?.name || 'Select article to load unit'}
                            readOnly
                            disabled
                            className="bg-slate-100 text-slate-700 font-medium cursor-not-allowed border-slate-300"
                        />
                        <input type="hidden" {...register('unit_of_measure_id', { valueAsNumber: true })} />
                        <p className="text-xs text-slate-500">Unit of measure is locked to the selected article.</p>
                    </div>
                </div>

                {/* 4. Quantity Requested & Unit Cost (UPPER IN BRAND AND MODEL) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                            Quantity Requested *
                        </label>
                        <Input
                            {...register('quantity_requested', { valueAsNumber: true })}
                            type="number"
                            min={1}
                            placeholder="Enter quantity"
                            error={errors.quantity_requested?.message}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                            Unit Cost (₱) *
                        </label>
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

                {/* 5. Brand, Model & Serial Number Section with Toggle */}
                <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-900">Brand</label>
                            <Input
                                {...register('brand')}
                                placeholder="Manufacturer or brand"
                                error={errors.brand?.message}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-900">Model</label>
                            <Input
                                {...register('model_number')}
                                placeholder="Model number"
                                error={errors.model_number?.message}
                            />
                        </div>
                    </div>

                    {/* With Serial Number / No Serial Number Toggle */}
                    <div className="space-y-3 border-t border-slate-200 pt-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Hash className="w-4 h-4 text-[var(--primary)]" />
                                <label className="text-sm font-semibold text-slate-900">Serial Numbers</label>
                            </div>

                            {/* Toggle Control */}
                            <div className="inline-flex items-center p-1 bg-slate-200/80 rounded-lg">
                                <button
                                    type="button"
                                    onClick={() => setHasSerialToggle(true)}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-150 ${hasSerialToggle
                                            ? 'bg-white text-slate-900 shadow-sm'
                                            : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                >
                                    With Serial Number
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setHasSerialToggle(false);
                                        setSerials([]);
                                        setValue('serial_number', '', { shouldValidate: true, shouldDirty: true });
                                        setSerialErrors({});
                                        clearErrors('serial_number');
                                    }}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-150 ${!hasSerialToggle
                                            ? 'bg-white text-slate-900 shadow-sm'
                                            : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                >
                                    No Serial Number
                                </button>
                            </div>
                        </div>

                        {/* Serial Number Inputs (Shown only when With Serial Number is toggled ON) */}
                        {hasSerialToggle && (
                            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <div className="text-xs text-slate-500 font-medium">
                                    Quantity is {requested || 1}. Automatically creating exactly {requested || 1} serial number field(s):
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    {serials.map((s, idx) => (
                                        <div key={idx} className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-semibold text-slate-500 min-w-[70px]">
                                                    Serial #{idx + 1}:
                                                </span>
                                                <Input
                                                    value={s}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setSerials(prev => prev.map((item, i) => i === idx ? val : item));
                                                        if (serialErrors[idx]) {
                                                            setSerialErrors(prev => {
                                                                const next = { ...prev };
                                                                delete next[idx];
                                                                return next;
                                                            });
                                                        }
                                                    }}
                                                    onBlur={() => validateSerials()}
                                                    placeholder={`Enter serial number for unit #${idx + 1}`}
                                                    className="flex-1 bg-white"
                                                />
                                            </div>
                                            {serialErrors[idx] && (
                                                <p className="text-xs text-red-600 ml-[78px] font-medium">{serialErrors[idx]}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {errors.serial_number && !Object.keys(serialErrors).length && (
                                    <p className="text-sm text-red-600">{errors.serial_number.message}</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* 6. Change Reason (if requested differs from delivered) */}
                {quantity !== requested && (
                    <div className="border-t border-slate-200 pt-4 space-y-2">
                        <label className="text-sm font-semibold text-slate-900">Change Reason *</label>
                        <textarea
                            {...register('change_reason')}
                            rows={3}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 resize-none"
                            placeholder="Reason for differences between requested and delivered"
                        />
                        {errors.change_reason && (
                            <p className="text-sm text-red-600">{errors.change_reason.message}</p>
                        )}
                    </div>
                )}

                {/* 7. Total Cost Display */}
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Calculator className="w-4 h-4 text-[var(--primary)]" />
                            <span className="text-sm font-semibold text-slate-900">Total Cost</span>
                        </div>
                        <span className="text-lg font-bold text-[var(--primary)]">
                            ₱{totalCost.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
            </div>
        </Dialog>
    );
}

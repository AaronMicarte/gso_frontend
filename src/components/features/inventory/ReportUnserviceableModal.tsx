'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    getAllInventoryItems,
    submitUnserviceableReport,
    type InventoryItem,
} from '@/lib/api/inventory';
import {
    AlertTriangle, X, Search, UploadCloud, FileText, Trash2, Eye, Loader2,
} from 'lucide-react';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
};

type AttachedFile = {
    file: File;
    id: string;
    previewUrl?: string;
    isPdf: boolean;
    isImage: boolean;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function formatBytes(bytes: number) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function ReportUnserviceableModal({ open, onOpenChange, onSuccess }: Props) {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [itemsList, setItemsList] = useState<InventoryItem[]>([]);
    const [selectedItems, setSelectedItems] = useState<Map<number, InventoryItem>>(new Map());
    const [remarks, setRemarks] = useState('');
    const [attachments, setAttachments] = useState<AttachedFile[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activePreview, setActivePreview] = useState<AttachedFile | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // search with a short debounce
    useEffect(() => {
        if (!open) return;

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const res = await getAllInventoryItems({
                    search: searchQuery.trim() || undefined,
                    per_page: 25,
                    display_mode: 'individual',
                });
                setItemsList(res.data || []);
            } catch {
                toast.error('Failed to load inventory assets');
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery, open]);

    function reset() {
        setSearchQuery('');
        setSelectedItems(new Map());
        setRemarks('');
        attachments.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl));
        setAttachments([]);
        setActivePreview(null);
        setIsSubmitting(false);
    }

    function handleClose(nextOpen: boolean) {
        if (!nextOpen) reset();
        onOpenChange(nextOpen);
    }

    function addFiles(incoming: FileList | File[]) {
        const accepted: AttachedFile[] = [];

        for (const file of Array.from(incoming)) {
            const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
            const isPdf = file.type === 'application/pdf' || ext === 'pdf';
            const isImage =
                file.type.startsWith('image/') ||
                ['jpg', 'jpeg', 'png', 'webp'].includes(ext);

            if (!isPdf && !isImage) {
                toast.error(`"${file.name}" is not a supported format. Use PDF, JPG, PNG, or WEBP.`);
                continue;
            }

            if (file.size > MAX_FILE_SIZE) {
                toast.error(`"${file.name}" is too large (${formatBytes(file.size)}). Limit is 10MB.`);
                continue;
            }

            accepted.push({
                file,
                id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                previewUrl: URL.createObjectURL(file),
                isPdf,
                isImage,
            });
        }

        if (accepted.length) {
            setAttachments((prev) => [...prev, ...accepted]);
        }
    }

    function removeAttachment(id: string) {
        setAttachments((prev) => {
            const target = prev.find((a) => a.id === id);
            if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
            return prev.filter((a) => a.id !== id);
        });
        if (activePreview?.id === id) setActivePreview(null);
    }

    function isItemUnserviceable(item: InventoryItem) {
        return item.ConditionName?.toLowerCase().includes('unserviceable') ?? false;
    }

    function toggleItem(item: InventoryItem) {
        if (isItemUnserviceable(item)) {
            toast.error('This item is already unserviceable and cannot be reported again.');
            return;
        }

        setSelectedItems((prev) => {
            const next = new Map(prev);
            if (next.has(item.InventoryDetailID)) {
                next.delete(item.InventoryDetailID);
            } else {
                next.set(item.InventoryDetailID, item);
            }
            return next;
        });
    }

    function selectAllVisible() {
        setSelectedItems((prev) => {
            const next = new Map(prev);
            itemsList.filter((i) => !isItemUnserviceable(i)).forEach((i) => next.set(i.InventoryDetailID, i));
            return next;
        });
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!selectedItems.size) {
            toast.error('Select at least one item to report.');
            return;
        }
        if (!attachments.length) {
            toast.error('Attach at least one supporting document.');
            return;
        }

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('remarks', remarks.trim());
            formData.append('items', JSON.stringify(Array.from(selectedItems.keys())));
            attachments.forEach((a) => formData.append('attachments[]', a.file));

            const res = await submitUnserviceableReport(formData);
            toast.success(res.message || 'Report submitted');
            queryClient.invalidateQueries({ queryKey: ['unserviceable-report-detail'] });
            queryClient.invalidateQueries({ queryKey: ['all-inventory-items'] });
            queryClient.invalidateQueries({ queryKey: ['inventories'] });
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            handleClose(false);
            onSuccess?.();
        } catch (err: unknown) {
            const error = err as {
                response?: { data?: { message?: string; errors?: { attachments?: string[]; items?: string[] } } };
            };
            toast.error(
                error?.response?.data?.message ||
                error?.response?.data?.errors?.attachments?.[0] ||
                error?.response?.data?.errors?.items?.[0] ||
                'Could not submit the report.'
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    const selectedList = useMemo(() => Array.from(selectedItems.values()), [selectedItems]);

    const footerMessage = !selectedItems.size
        ? 'Select at least one item'
        : !attachments.length
            ? 'Attach proof before submitting'
            : null;

    return (
        <Dialog.Root open={open} onOpenChange={handleClose}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />

                <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col focus:outline-none">
                    <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                        <div>
                            <Dialog.Title className="text-base font-semibold text-slate-900">
                                Report Unserviceable Items
                            </Dialog.Title>
                            <Dialog.Description className="text-xs text-slate-500 mt-0.5">
                                Pick the affected items, add remarks, and attach proof.
                            </Dialog.Description>
                        </div>
                        <Dialog.Close className="p-2 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                            <X className="w-5 h-5" />
                        </Dialog.Close>
                    </div>

                    <div className="overflow-y-auto flex-1 p-6 space-y-6">
                        {/* items */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-slate-700">
                                    1. Items
                                    {selectedItems.size > 0 && (
                                        <span className="ml-2 text-slate-500">
                                            ({selectedItems.size} selected)
                                        </span>
                                    )}
                                </label>
                                <div className="flex items-center gap-3 text-xs">
                                    <button
                                        type="button"
                                        onClick={selectAllVisible}
                                        className="text-blue-600 hover:underline"
                                    >
                                        Select all shown
                                    </button>
                                    {selectedItems.size > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedItems(new Map())}
                                            className="text-slate-500 hover:underline"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search article, description, serial, property #, personnel, office..."
                                    className="w-full pl-9 pr-8 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            <div className="border border-slate-200 rounded overflow-hidden max-h-56 overflow-y-auto">
                                {isSearching ? (
                                    <div className="py-8 flex items-center justify-center gap-2 text-slate-500 text-xs">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Searching...
                                    </div>
                                ) : itemsList.length === 0 ? (
                                    <div className="py-8 text-center text-xs text-slate-500">
                                        {searchQuery ? 'No matches.' : 'Type to search inventory.'}
                                    </div>
                                ) : (
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 sticky top-0">
                                            <tr>
                                                <th className="px-3 py-2 w-8"></th>
                                                <th className="px-3 py-2">Item</th>
                                                <th className="px-3 py-2">Details</th>
                                                <th className="px-3 py-2">Assigned</th>
                                                <th className="px-3 py-2">Condition</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {itemsList.map((item) => {
                                                const checked = selectedItems.has(item.InventoryDetailID);
                                                const article = item.dr_article_name || item.PropertyName || 'Asset';
                                                const specs =
                                                    [item.Brand, item.ModelNumber, item.SerialNumber && `S/N ${item.SerialNumber}`]
                                                        .filter(Boolean)
                                                        .join(' · ') || '—';

                                                const alreadyUnserviceable = isItemUnserviceable(item);

                                                return (
                                                    <tr
                                                        key={item.InventoryDetailID}
                                                        onClick={() => !alreadyUnserviceable && toggleItem(item)}
                                                        className={
                                                            alreadyUnserviceable
                                                                ? 'opacity-60 bg-slate-50 cursor-not-allowed'
                                                                : checked
                                                                    ? 'bg-amber-50 cursor-pointer'
                                                                    : 'hover:bg-slate-50 cursor-pointer'
                                                        }
                                                    >
                                                        <td className="px-3 py-2">
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                disabled={alreadyUnserviceable}
                                                                onChange={() => !alreadyUnserviceable && toggleItem(item)}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="h-4 w-4 rounded border-slate-300 disabled:opacity-40"
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <div className="font-medium text-slate-900 truncate max-w-[180px]">
                                                                {article}
                                                            </div>
                                                            <div className="text-[11px] text-slate-500 font-mono">
                                                                {item.PropertyNumber || `#${item.InventoryDetailID}`}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <div className="truncate max-w-[220px] text-slate-700">
                                                                {item.Description || item.dr_item_description || '—'}
                                                            </div>
                                                            <div className="text-[11px] text-slate-500 truncate max-w-[220px]">
                                                                {specs}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <div className="truncate max-w-[170px] text-slate-700">
                                                                {item.custodianName || item.endUserName || 'Unassigned'}
                                                            </div>
                                                            <div className="text-[11px] text-slate-500 truncate max-w-[170px]">
                                                                {item.locationDepartment || '—'}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <span
                                                                className={
                                                                    item.ConditionName?.toLowerCase().includes('unserviceable')
                                                                        ? 'text-rose-600 text-[11px] font-medium'
                                                                        : 'text-emerald-700 text-[11px]'
                                                                }
                                                            >
                                                                {item.ConditionName || 'Serviceable'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            {selectedList.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {selectedList.map((item) => (
                                        <span
                                            key={item.InventoryDetailID}
                                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 text-xs text-slate-700"
                                        >
                                            {item.dr_article_name || item.PropertyName || 'Asset'}
                                            <span className="text-slate-400 font-mono text-[11px]">
                                                {item.PropertyNumber || `#${item.InventoryDetailID}`}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => toggleItem(item)}
                                                className="text-slate-400 hover:text-rose-600"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* remarks */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-700">
                                2. Remarks
                                <span className="ml-2 font-normal text-slate-500">(optional)</span>
                            </label>
                            <textarea
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                placeholder="Damage, wear, failure reason..."
                                rows={2}
                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>

                        {/* files */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-slate-700">
                                    3. Proof <span className="text-rose-500">*</span>
                                </label>
                                <span className="text-[11px] text-slate-500">
                                    PDF, JPG, PNG, WEBP · max 10MB
                                </span>
                            </div>

                            <div
                                onClick={() => fileInputRef.current?.click()}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
                                }}
                                className="border border-dashed border-slate-300 rounded p-5 text-center cursor-pointer hover:bg-slate-50"
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    accept=".pdf,image/jpeg,image/png,image/webp,image/jpg"
                                    className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files) addFiles(e.target.files);
                                        e.target.value = '';
                                    }}
                                />
                                <UploadCloud className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                                <p className="text-xs text-slate-600">
                                    Click or drop files here
                                </p>
                            </div>

                            {attachments.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {attachments.map((att) => (
                                        <div
                                            key={att.id}
                                            className="flex items-center justify-between p-2 rounded border border-slate-200 gap-2"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                {att.isImage ? (
                                                    /* eslint-disable-next-line @next/next/no-img-element */
                                                    <img
                                                        src={att.previewUrl}
                                                        alt=""
                                                        className="w-8 h-8 rounded object-cover border border-slate-200 cursor-pointer"
                                                        onClick={() => setActivePreview(att)}
                                                    />
                                                ) : (
                                                    <FileText className="w-8 h-8 p-1.5 text-rose-600 border border-slate-200 rounded" />
                                                )}
                                                <div className="min-w-0">
                                                    <p className="text-xs text-slate-900 truncate" title={att.file.name}>
                                                        {att.file.name}
                                                    </p>
                                                    <p className="text-[10px] text-slate-500">
                                                        {formatBytes(att.file.size)}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1">
                                                {att.previewUrl && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setActivePreview(att)}
                                                        className="p-1 text-slate-500 hover:text-slate-800"
                                                    >
                                                        <Eye className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => removeAttachment(att.id)}
                                                    className="p-1 text-slate-400 hover:text-rose-600"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
                        <div className="text-xs text-slate-500">
                            {footerMessage ?? `${selectedItems.size} item${selectedItems.size > 1 ? 's' : ''} ready`}
                        </div>

                        <div className="flex items-center gap-2">
                            <Dialog.Close asChild>
                                <button
                                    type="button"
                                    disabled={isSubmitting}
                                    className="px-4 py-2 text-sm text-slate-700 border border-slate-300 rounded hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                            </Dialog.Close>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={isSubmitting || !selectedItems.size || !attachments.length}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-rose-600 hover:bg-rose-700 text-white rounded disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <AlertTriangle className="w-4 h-4" />
                                        Submit
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {activePreview && (
                        <div className="fixed inset-0 z-60 bg-black/75 flex items-center justify-center p-4">
                            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                                    <div className="text-sm font-medium text-slate-900 truncate">
                                        {activePreview.file.name}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setActivePreview(null)}
                                        className="p-1 text-slate-500 hover:text-slate-800"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="p-4 flex-1 overflow-auto flex items-center justify-center min-h-[300px]">
                                    {activePreview.isImage && (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img
                                            src={activePreview.previewUrl}
                                            alt={activePreview.file.name}
                                            className="max-h-[70vh] max-w-full object-contain"
                                        />
                                    )}
                                    {activePreview.isPdf && (
                                        <iframe
                                            src={activePreview.previewUrl}
                                            title="PDF preview"
                                            className="w-full h-[65vh] border-0"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
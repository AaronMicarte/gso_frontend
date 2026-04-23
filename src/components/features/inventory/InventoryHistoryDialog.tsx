'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { History, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { useInventoryDetailHistory } from '@/lib/hooks/useInventory';
import type { InventoryHistoryItem } from '@/lib/api/inventory';

const formatManilaDateTime = (value: string) => {
    const raw = (value || '').trim();
    if (!raw) return 'Unknown date';

    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return 'Unknown date';

    return format(toZonedTime(date, 'Asia/Manila'), 'MMM dd, yyyy h:mm a');
};

const formatMetaKey = (key: string) => {
    return key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatMetaValue = (value: unknown): string => {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'string') return value;

    if (Array.isArray(value)) {
        const parts = value.map((item) => formatMetaValue(item)).filter((item) => item !== '-');
        return parts.length > 0 ? parts.join(', ') : '-';
    }

    if (typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>)
            .filter(([, val]) => val !== null && val !== undefined && val !== '');
        if (entries.length === 0) return '-';
        return entries
            .map(([key, val]) => `${formatMetaKey(key)}: ${formatMetaValue(val)}`)
            .join(' | ');
    }

    return String(value);
};

const renderMeta = (meta?: Record<string, unknown> | null) => {
    if (!meta) return null;
    // exclude identifier fields (e.g. "iar_id", "inventory_detail_id") from details
    const entries = Object.entries(meta)
        .filter(([, value]) => value !== null && value !== undefined && value !== '')
        .filter(([key]) => !/\b(id|.*_id)\b/i.test(key));
    if (entries.length === 0) return null;

    return (
        <details className="mt-2 text-xs text-slate-600">
            <summary className="cursor-pointer text-slate-500 hover:text-slate-700">Details</summary>
            <dl className="mt-2 grid gap-2 rounded-lg bg-slate-50 p-3 text-[11px] text-slate-700">
                {entries.map(([key, value]) => (
                    <div key={key} className="grid grid-cols-[120px_1fr] gap-2">
                        <dt className="text-slate-500">{formatMetaKey(key)}</dt>
                        <dd className="text-slate-800 break-words">{formatMetaValue(value)}</dd>
                    </div>
                ))}
            </dl>
        </details>
    );
};

const HistoryItem = ({ item }: { item: InventoryHistoryItem }) => (
    <div className="flex gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <div className="mt-2 h-2 w-2 rounded-full bg-slate-400" />
        <div className="flex-1">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase rounded px-2 py-0.5 bg-slate-100 text-slate-600">{item.type}</span>
                    <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                </div>
                <div className="text-xs text-slate-500">{formatManilaDateTime(item.occurred_at)}</div>
            </div>
            {item.description && <div className="text-xs text-slate-600">{item.description}</div>}
            {item.actor?.name && <div className="text-xs text-slate-500">By {item.actor.name}</div>}
            {renderMeta(item.meta)}
        </div>
    </div>
);

export function InventoryHistoryDialog({ inventoryDetailId, itemName }: { inventoryDetailId: number; itemName: string }) {
    const [open, setOpen] = useState(false);
    const { data, isLoading, isError } = useInventoryDetailHistory(inventoryDetailId, open);
    const history = (data?.history ?? [])
        .map((item, index) => ({ item, index }))
        .filter(({ item }, idx, arr) => {
            const fingerprint = `${item.type}|${item.action}|${item.occurred_at}|${item.actor?.id ?? 0}|${item.title}|${item.description ?? ''}|${JSON.stringify(item.meta ?? {})}`;
            return arr.findIndex((candidate) => {
                const c = candidate.item;
                const cf = `${c.type}|${c.action}|${c.occurred_at}|${c.actor?.id ?? 0}|${c.title}|${c.description ?? ''}|${JSON.stringify(c.meta ?? {})}`;
                return cf === fingerprint;
            }) === idx;
        })
        .sort((a, b) => {
            const timeA = new Date(a.item.occurred_at).getTime();
            const timeB = new Date(b.item.occurred_at).getTime();
            if (Number.isNaN(timeA) || Number.isNaN(timeB)) return b.index - a.index;
            return timeB - timeA || b.index - a.index;
        })
        .map(({ item }) => item);

    return (
        <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
                <button
                    type="button"
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    title="View History"
                >
                    <History className="w-4 h-4" />
                </button>
            </Dialog.Trigger>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/30 z-40" />
                <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl w-full max-w-2xl p-6">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <Dialog.Title className="text-lg font-bold text-slate-900">Item History</Dialog.Title>
                            <Dialog.Description className="text-sm text-slate-600">{itemName}</Dialog.Description>
                        </div>
                        <Dialog.Close asChild>
                            <button className="text-sm text-slate-500 hover:text-slate-700">Close</button>
                        </Dialog.Close>
                    </div>

                    <div className="mt-4 max-h-[60vh] overflow-y-auto pr-2">
                        {isLoading ? (
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading history...
                            </div>
                        ) : isError ? (
                            <div className="text-sm text-red-600">Failed to load history.</div>
                        ) : history.length === 0 ? (
                            <div className="text-sm text-slate-500">No history recorded for this item yet.</div>
                        ) : (
                            <div className="space-y-3">
                                {history.map((item, index) => (
                                    <HistoryItem key={`${item.action}-${item.occurred_at}-${index}`} item={item} />
                                ))}
                            </div>
                        )}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

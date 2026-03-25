'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, PlusCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

import transferAPI from '@/lib/api/transfer';
import {
    PropertyTransferCreatePayload,
    TransferDepartment,
    TransferEndUser,
    TransferableItem,
} from '@/types/propertyTransfer';
import { useAuth } from '@/lib/hooks/useAuth';

interface TransferCreatePageProps {
    baseRoute: string;
}

export function TransferCreatePage({ baseRoute }: TransferCreatePageProps) {
    const router = useRouter();
    const { user } = useAuth();
    const [departments, setDepartments] = useState<TransferDepartment[]>([]);
    const [fromEndUsers, setFromEndUsers] = useState<TransferEndUser[]>([]);
    const [toEndUsers, setToEndUsers] = useState<TransferEndUser[]>([]);
    const [availableItems, setAvailableItems] = useState<TransferableItem[]>([]);
    const [selectedGroups, setSelectedGroups] = useState<Array<{ key: string; quantity: number }>>([]);
    const [availableQuantities, setAvailableQuantities] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(false);
    const [itemLoading, setItemLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [reason, setReason] = useState('');
    const [fromEndUserSearch, setFromEndUserSearch] = useState('');
    const [releasingComboboxOpen, setReleasingComboboxOpen] = useState(false);
    const [releasingHighlightedIndex, setReleasingHighlightedIndex] = useState(-1);
    const releasingComboboxRef = useRef<HTMLDivElement | null>(null);

    const [fromDepartmentId, setFromDepartmentId] = useState<number | ''>('');
    const [toDepartmentId, setToDepartmentId] = useState<number | ''>(user?.DepartmentID ?? '');
    const [fromEndUserId, setFromEndUserId] = useState<number | ''>('');
    const [toEndUserId, setToEndUserId] = useState<number | ''>('');

    const [receivingEndUser, setReceivingEndUser] = useState<TransferEndUser | null>(null);
    const [receivingError, setReceivingError] = useState<string | null>(null);

    const isDepartmentHead = user?.UserRoleID === 4;

    const formattedToday = format(toZonedTime(new Date(), 'Asia/Manila'), 'MMM dd, yyyy');

    const loadHelpers = useCallback(async () => {
        try {
            const [deptData, receivingEndUsers, releasingEndUsers] = await Promise.all([
                transferAPI.getDepartments(),
                user?.DepartmentID ? transferAPI.getEndUsers(user.DepartmentID) : Promise.resolve([]),
                transferAPI.getEndUsers(undefined, { excludeGso: true }),
            ]);
            setDepartments(deptData);
            setToEndUsers(receivingEndUsers);
            setFromEndUsers(releasingEndUsers);
        } catch {
            toast.error('Failed to load transfer helpers');
        }
    }, [user?.DepartmentID]);

    const loadAvailableItems = useCallback(async () => {
        if (!fromDepartmentId || !fromEndUserId) {
            setAvailableItems([]);
            return;
        }

        try {
            setItemLoading(true);
            const data = await transferAPI.getAvailableItems({
                search: searchTerm || undefined,
                from_department_id: Number(fromDepartmentId),
                from_end_user_id: Number(fromEndUserId),
                per_page: 20,
            });
            setAvailableItems(data.data || []);
        } catch {
            toast.error('Failed to load transfer items');
        } finally {
            setItemLoading(false);
        }
    }, [fromDepartmentId, fromEndUserId, searchTerm]);

    useEffect(() => {
        loadHelpers();
    }, [loadHelpers]);

    useEffect(() => {
        const onClickOutside = (event: MouseEvent) => {
            if (releasingComboboxRef.current && !releasingComboboxRef.current.contains(event.target as Node)) {
                setReleasingComboboxOpen(false);
                setReleasingHighlightedIndex(-1);
            }
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    useEffect(() => {
        if (user?.DepartmentID && !toDepartmentId) {
            setToDepartmentId(user.DepartmentID);
        }
    }, [user?.DepartmentID, toDepartmentId]);

    useEffect(() => {
        if (isDepartmentHead && user?.DepartmentID) {
            setToDepartmentId(user.DepartmentID);
        }
    }, [isDepartmentHead, user?.DepartmentID]);

    useEffect(() => {
        if (!toDepartmentId) {
            setToEndUsers([]);
            setToEndUserId('');
            setReceivingEndUser(null);
            setReceivingError(null);
            return;
        }

        transferAPI.getEndUsers(Number(toDepartmentId))
            .then((endUsers) => {
                setToEndUsers(endUsers);
                const requesterName = (user?.FullName || '').trim().toLowerCase();
                const match = endUsers.find((entry) => entry.FullName.trim().toLowerCase() === requesterName) || null;
                if (!match) {
                    setReceivingEndUser(null);
                    setToEndUserId('');
                    setReceivingError('Requester must have a matching End User record in their department.');
                } else {
                    setReceivingEndUser(match);
                    setToEndUserId(match.EndUserID);
                    setReceivingError(null);
                }
            })
            .catch(() => toast.error('Failed to load receiving end users'));
    }, [toDepartmentId, user?.FullName]);

    useEffect(() => {
        loadAvailableItems();
    }, [loadAvailableItems]);

    useEffect(() => {
        setSelectedGroups([]);
        setAvailableQuantities({});
    }, [fromDepartmentId, fromEndUserId]);

    type GroupedAvailableItem = {
        key: string;
        items: TransferableItem[];
        article: string;
        itemDescription: string;
        fullSpecs: string;
        unitName: string;
    };

    const buildItemDescription = (item: TransferableItem) => (
        item.ItemDescription || item.InventoryDescription || item.AssignedDescription || 'Item'
    );

    const buildFullSpecs = (item: TransferableItem) => (
        [item.Brand, item.ModelNumber, item.SerialNumber ? `SN: ${item.SerialNumber}` : null]
            .filter(Boolean)
            .join(' | ')
    );

    const buildGroupKey = (item: TransferableItem) => {
        const serialKey = item.SerialNumber || 'no-serial';
        const brandKey = item.Brand || 'no-brand';
        const modelKey = item.ModelNumber || 'no-model';
        const descKey = buildItemDescription(item);
        return `${serialKey}||${brandKey}||${modelKey}||${descKey}`;
    };

    const groupedAvailableItems = useMemo(() => {
        const groups = new Map<string, GroupedAvailableItem>();

        for (const item of availableItems) {
            const key = buildGroupKey(item);
            if (!groups.has(key)) {
                groups.set(key, {
                    key,
                    items: [],
                    article: item.ArticleName || 'Missing article',
                    itemDescription: buildItemDescription(item),
                    fullSpecs: buildFullSpecs(item) || 'Missing full specs',
                    unitName: item.UnitName || 'unit',
                });
            }
            groups.get(key)!.items.push(item);
        }

        return Array.from(groups.values()).map((group) => {
            const sortedItems = [...group.items].sort((a, b) => {
                const left = a.PropertyNumber || '';
                const right = b.PropertyNumber || '';
                return left.localeCompare(right);
            });
            return { ...group, items: sortedItems };
        });
    }, [availableItems]);

    useEffect(() => {
        if (groupedAvailableItems.length === 0) {
            setAvailableQuantities({});
            setSelectedGroups([]);
            return;
        }

        setAvailableQuantities((prev) => {
            const next: Record<string, number> = {};
            for (const group of groupedAvailableItems) {
                const existing = prev[group.key];
                const maxQty = group.items.length;
                const clamped = typeof existing === 'number'
                    ? Math.min(Math.max(existing, 1), maxQty)
                    : 1;
                next[group.key] = clamped;
            }
            return next;
        });

        setSelectedGroups((prev) => (
            prev
                .filter((entry) => groupedAvailableItems.some((group) => group.key === entry.key))
                .map((entry) => {
                    const group = groupedAvailableItems.find((g) => g.key === entry.key);
                    const maxQty = group ? group.items.length : entry.quantity;
                    return {
                        ...entry,
                        quantity: Math.min(Math.max(entry.quantity, 1), maxQty),
                    };
                })
        ));
    }, [groupedAvailableItems]);

    const updateAvailableQuantity = (key: string, value: number, maxQty: number) => {
        const nextValue = Math.min(Math.max(value, 1), maxQty);

        setAvailableQuantities((prev) => ({ ...prev, [key]: nextValue }));

        // If this group is already selected, update its selected quantity live
        setSelectedGroups((prev) => prev.map((entry) => {
            if (entry.key !== key) return entry;
            // clamp to available max
            const clamped = Math.min(Math.max(nextValue, 1), maxQty);
            return { ...entry, quantity: clamped };
        }));
    };

    const handleAddGroup = (group: GroupedAvailableItem) => {
        const desiredQty = availableQuantities[group.key] ?? 1;
        const maxQty = group.items.length;
        const nextQty = Math.min(Math.max(desiredQty, 1), maxQty);

        setSelectedGroups((prev) => {
            const existing = prev.find((entry) => entry.key === group.key);
            if (existing) {
                return prev.map((entry) => (
                    entry.key === group.key ? { ...entry, quantity: nextQty } : entry
                ));
            }
            return [...prev, { key: group.key, quantity: nextQty }];
        });
    };

    const handleRemoveGroup = (key: string) => {
        setSelectedGroups((prev) => prev.filter((entry) => entry.key !== key));
    };

    const isGroupSelected = (key: string) => selectedGroups.some((entry) => entry.key === key);

    const renderPropertyNumbers = (items: TransferableItem[]) => {
        if (items.length <= 1) {
            return items[0]?.PropertyNumber || 'Missing property number';
        }

        return (
            <details className="text-sm text-slate-700">
                <summary className="cursor-pointer text-slate-700">Multiple ({items.length})</summary>
                <div className="mt-2 space-y-1 text-xs text-slate-500">
                    {items.map((item) => (
                        <div key={item.InventoryDetailID}>{item.PropertyNumber || 'Missing property number'}</div>
                    ))}
                </div>
            </details>
        );
    };

    const filteredFromEndUsers = useMemo(() => {
        const term = fromEndUserSearch.trim().toLowerCase();
        const requesterName = (user?.FullName || '').trim().toLowerCase();
        const requesterDepartmentId = user?.DepartmentID ?? null;

        return fromEndUsers.filter((endUser) => {
            if (requesterDepartmentId && endUser.DepartmentID === requesterDepartmentId) {
                return false;
            }
            if (requesterName && endUser.FullName.trim().toLowerCase() === requesterName) {
                return false;
            }
            if (!term) return true;
            const display = `${endUser.FullName} ${endUser.DepartmentName ?? ''}`.toLowerCase();
            return display.includes(term);
        });
    }, [fromEndUsers, fromEndUserSearch, user?.FullName, user?.DepartmentID]);

    const canSubmit = useMemo(() => {
        return !!fromDepartmentId
            && !!toDepartmentId
            && !!fromEndUserId
            && !!toEndUserId
            && selectedGroups.length > 0
            && fromDepartmentId !== toDepartmentId
            && !receivingError;
    }, [fromDepartmentId, toDepartmentId, fromEndUserId, toEndUserId, selectedGroups, receivingError]);

    const handleSubmit = async () => {
        if (!canSubmit) {
            toast.error('Complete all required fields before submitting');
            return;
        }

        const groupedByKey = new Map(groupedAvailableItems.map((group) => [group.key, group]));
        const inventoryDetailIds: number[] = [];

        for (const entry of selectedGroups) {
            const group = groupedByKey.get(entry.key);
            if (!group) continue;
            const maxQty = group.items.length;
            const qty = Math.min(Math.max(entry.quantity, 1), maxQty);
            const selectedItems = group.items.slice(0, qty);
            inventoryDetailIds.push(...selectedItems.map((item) => item.InventoryDetailID));
        }

        if (inventoryDetailIds.length === 0) {
            toast.error('Select at least one item to transfer');
            return;
        }

        const payload: PropertyTransferCreatePayload = {
            from_department_id: Number(fromDepartmentId),
            to_department_id: Number(toDepartmentId),
            from_end_user_id: Number(fromEndUserId),
            to_end_user_id: Number(toEndUserId),
            reason: reason.trim() || null,
            items: inventoryDetailIds.map((inventoryDetailId) => ({
                inventory_detail_id: inventoryDetailId,
                quantity: 1,
            })),
        };

        try {
            setLoading(true);
            const response = await transferAPI.create(payload);
            toast.success('Transfer request submitted');
            router.push(`${baseRoute}/${response.transfer.TransferID}`);
        } catch (error: unknown) {
            const maybeAxios = error as { response?: { data?: { message?: string } } };
            const message = maybeAxios?.response?.data?.message;
            toast.error(message || 'Failed to submit transfer request');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}>
            <div className="p-6 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Create Transfer Request</h1>
                    <p className="text-slate-500 text-sm">Prepare the PTR request for GSO approval and paper signing</p>
                </div>

                <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                            <div className="text-sm text-slate-600">Request Date: {formattedToday}</div>
                            <div className="text-sm text-slate-600">
                                Requested By: {user?.FullName || 'Missing requester'}{user?.Department ? ` - ${user.Department}` : ''}
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Releasing Custodian (Current Holder)</label>
                                    <div className="relative mt-2" ref={releasingComboboxRef}>
                                        <input
                                            type="text"
                                            role="combobox"
                                            aria-expanded={releasingComboboxOpen}
                                            aria-controls="releasing-listbox"
                                            aria-autocomplete="list"
                                            value={fromEndUserSearch}
                                            onChange={(event) => {
                                                setFromEndUserSearch(event.target.value);
                                                setReleasingComboboxOpen(true);
                                                setReleasingHighlightedIndex(-1);
                                            }}
                                            onFocus={() => setReleasingComboboxOpen(true)}
                                            onKeyDown={(event) => {
                                                if (!releasingComboboxOpen) return;
                                                if (event.key === 'ArrowDown') {
                                                    event.preventDefault();
                                                    setReleasingHighlightedIndex((prev) => Math.min(prev + 1, filteredFromEndUsers.length - 1));
                                                } else if (event.key === 'ArrowUp') {
                                                    event.preventDefault();
                                                    setReleasingHighlightedIndex((prev) => Math.max(prev - 1, 0));
                                                } else if (event.key === 'Enter') {
                                                    event.preventDefault();
                                                    const selected = filteredFromEndUsers[releasingHighlightedIndex];
                                                    if (selected) {
                                                        setFromEndUserId(selected.EndUserID);
                                                        setFromDepartmentId(selected.DepartmentID ?? '');
                                                        setFromEndUserSearch(`${selected.FullName}${selected.DepartmentName ? ` - ${selected.DepartmentName}` : ''}`);
                                                        setReleasingComboboxOpen(false);
                                                    }
                                                } else if (event.key === 'Escape') {
                                                    setReleasingComboboxOpen(false);
                                                    setReleasingHighlightedIndex(-1);
                                                }
                                            }}
                                            placeholder="Search custodian"
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)]"
                                        />
                                        {releasingComboboxOpen && (
                                            <ul id="releasing-listbox" role="listbox" className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded shadow-sm max-h-48 overflow-auto">
                                                {filteredFromEndUsers.length === 0 ? (
                                                    <li className="px-3 py-2 text-sm text-slate-500">No matching custodians.</li>
                                                ) : (
                                                    filteredFromEndUsers.map((endUser, idx) => (
                                                        <li
                                                            key={endUser.EndUserID}
                                                            role="option"
                                                            aria-selected={releasingHighlightedIndex === idx}
                                                            onMouseDown={(e) => {
                                                                e.preventDefault();
                                                                setFromEndUserId(endUser.EndUserID);
                                                                setFromDepartmentId(endUser.DepartmentID ?? '');
                                                                setFromEndUserSearch(`${endUser.FullName}${endUser.DepartmentName ? ` - ${endUser.DepartmentName}` : ''}`);
                                                                setReleasingComboboxOpen(false);
                                                            }}
                                                            onMouseEnter={() => setReleasingHighlightedIndex(idx)}
                                                            className={`px-3 py-2 text-sm cursor-pointer ${releasingHighlightedIndex === idx ? 'bg-[var(--primary)] text-white' : 'hover:bg-slate-100'}`}
                                                        >
                                                            {endUser.FullName}{endUser.DepartmentName ? ` - ${endUser.DepartmentName}` : ''}
                                                        </li>
                                                    ))
                                                )}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Receiving Custodian (Requester)</label>
                                    <input
                                        type="text"
                                        value={receivingEndUser
                                            ? `${receivingEndUser.FullName}${receivingEndUser.DepartmentName ? ` - ${receivingEndUser.DepartmentName}` : ''}`
                                            : `${user?.FullName ?? 'Missing requester'}${user?.Department ? ` - ${user.Department}` : ''}`}
                                        readOnly
                                        className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-700"
                                    />
                                    {receivingError && (
                                        <p className="mt-2 text-sm text-red-600">{receivingError}</p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-slate-700">Reason / Notes</label>
                                <textarea
                                    value={reason}
                                    onChange={(event) => setReason(event.target.value)}
                                    rows={3}
                                    className="mt-2 w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)]"
                                    placeholder="Optional reason for transfer"
                                />
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900">Select Items to Transfer</h2>
                                    <p className="text-sm text-slate-500">Only issued items assigned to the releasing custodian are listed</p>
                                </div>
                                <div className="relative w-full md:w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search items"
                                        value={searchTerm}
                                        onChange={(event) => setSearchTerm(event.target.value)}
                                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)]"
                                    />
                                </div>
                            </div>

                            {itemLoading ? (
                                <div className="flex items-center justify-center py-10 text-slate-500">Loading items...</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-slate-200">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Add</th>
                                                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Property #</th>
                                                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Item Description</th>
                                                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">End User</th>
                                                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Qty</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {groupedAvailableItems.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                                                        {(!fromDepartmentId || !fromEndUserId)
                                                            ? 'Select a borrower to view transferable assets.'
                                                            : 'No eligible items found (issued only, not already in an active transfer).'}
                                                    </td>
                                                </tr>
                                            ) : (
                                                groupedAvailableItems.map((group) => {
                                                    const qtyAvailable = group.items.length;
                                                    const qtySelected = availableQuantities[group.key] ?? 1;
                                                    const groupSelected = isGroupSelected(group.key);

                                                    return (
                                                        <tr key={group.key} className="hover:bg-slate-50">
                                                            <td className="px-3 py-2">
                                                                {groupSelected ? (
                                                                    <button
                                                                        onClick={() => handleRemoveGroup(group.key)}
                                                                        className="text-red-500 hover:text-red-600"
                                                                        aria-label="Remove group"
                                                                    >
                                                                        <Trash2 className="w-5 h-5" />
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => handleAddGroup(group)}
                                                                        className="text-[var(--primary)] hover:text-[var(--primary-hover)]"
                                                                        aria-label="Add group"
                                                                    >
                                                                        <PlusCircle className="w-5 h-5" />
                                                                    </button>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2 text-sm text-slate-700">
                                                                {renderPropertyNumbers(group.items)}
                                                            </td>
                                                            <td className="px-3 py-2 text-sm text-slate-700">
                                                                {group.itemDescription}
                                                            </td>
                                                            <td className="px-3 py-2 text-sm text-slate-700">
                                                                {group.items[0]?.EndUserName || 'Missing end user'}
                                                            </td>
                                                            <td className="px-3 py-2 text-sm text-slate-700">
                                                                <input
                                                                    type="number"
                                                                    min={1}
                                                                    max={qtyAvailable}
                                                                    value={qtySelected}
                                                                    onChange={(event) => updateAvailableQuantity(
                                                                        group.key,
                                                                        Number(event.target.value || 1),
                                                                        qtyAvailable
                                                                    )}
                                                                    className="w-20 px-2 py-1 border border-slate-300 rounded"
                                                                />
                                                                <span className="ml-2 text-xs text-slate-500">/ {qtyAvailable}</span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h2 className="text-lg font-semibold text-slate-900">Selected Items for Transfer</h2>
                            <p className="text-sm text-slate-500">PTR requires signed paper copies (4x)</p>

                            <div className="mt-4 overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Qty</th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Property #</th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Article</th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Item Description</th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Full Specs</th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Unit</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {selectedGroups.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                                                    No items selected yet.
                                                </td>
                                            </tr>
                                        ) : (
                                            selectedGroups.map((entry) => {
                                                const group = groupedAvailableItems.find((g) => g.key === entry.key);
                                                if (!group) return null;
                                                const maxQty = group.items.length;
                                                const qty = Math.min(Math.max(entry.quantity, 1), maxQty);
                                                const selectedItems = group.items.slice(0, qty);

                                                return (
                                                    <tr key={entry.key}>
                                                        <td className="px-3 py-2 text-sm text-slate-700">
                                                            {qty}
                                                        </td>
                                                        <td className="px-3 py-2 text-sm text-slate-700">
                                                            {renderPropertyNumbers(selectedItems)}
                                                        </td>
                                                        <td className="px-3 py-2 text-sm text-slate-700">
                                                            {group.article}
                                                        </td>
                                                        <td className="px-3 py-2 text-sm text-slate-700">
                                                            {group.itemDescription}
                                                        </td>
                                                        <td className="px-3 py-2 text-sm text-slate-700">
                                                            {group.fullSpecs}
                                                        </td>
                                                        <td className="px-3 py-2 text-sm text-slate-700">
                                                            {group.unitName}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <button
                                onClick={handleSubmit}
                                disabled={!canSubmit || loading}
                                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-white text-sm hover:bg-[var(--primary-hover)] disabled:opacity-50"
                            >
                                {loading ? 'Submitting...' : 'Submit Transfer Request'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

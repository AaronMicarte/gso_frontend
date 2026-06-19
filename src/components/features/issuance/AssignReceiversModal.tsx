import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import issuanceAPI from '@/lib/api/issuance';
import { toast } from 'sonner';

interface AssignmentRow {
    id: string;
    receiver_name: string;
    issuance_detail_id: string; // Switched to string to reference aggregate labels safely
    quantity: number;
    isDropdownOpen?: boolean;
    searchQuery: string;
}

interface Props {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    issuanceId: number | null;
    items: Array<{
        IssuanceDetailID: number;
        ItemDescription?: string | null;
        QuantityIssued?: number | null;
        Article?: string | null;
        Brand?: string | null;
        ModelNumber?: string | null;
        SerialNumber?: string | null;
    }>;
    onSaved?: () => void;
}

function uid() { return Math.random().toString(36).slice(2, 9); }

export default function AssignReceiversModal({ open, onOpenChange, issuanceId, items, onSaved }: Props) {
    const [rows, setRows] = React.useState<AssignmentRow[]>([]);
    const [saving, setSaving] = React.useState(false);
    const [loadingHistory, setLoadingHistory] = React.useState(false);
    const [allowPartialPrint, setAllowPartialPrint] = React.useState(false);

    // Group items by text features to solve the 1/1 duplication pool issue completely
    const availableItems = React.useMemo(() => {
        const itemMap: Record<string, { ids: number[]; label: string; maxQty: number }> = {};

        (items || []).forEach(it => {
            const label = [it.Article, it.Brand, it.ModelNumber, it.SerialNumber]
                .filter(Boolean)
                .join(' · ') || (it.ItemDescription || 'Item');

            const itemQty = Math.max(1, Number(it.QuantityIssued ?? 1));

            if (itemMap[label]) {
                itemMap[label].maxQty += itemQty;
                if (!itemMap[label].ids.includes(it.IssuanceDetailID)) {
                    itemMap[label].ids.push(it.IssuanceDetailID);
                }
            } else {
                itemMap[label] = {
                    ids: [it.IssuanceDetailID],
                    label,
                    maxQty: itemQty
                };
            }
        });

        return Object.values(itemMap).map(group => ({
            id: group.label, // Identify options uniquely by label string
            allDetailIds: group.ids, // Keep reference to underlying DB keys for save actions
            label: group.label,
            maxQty: group.maxQty
        }));
    }, [items]);

    React.useEffect(() => {
        if (!open || !issuanceId) return;

        async function loadSavedAssignments(validId: number) {
            try {
                setLoadingHistory(true);
                setAllowPartialPrint(false);

                const response = await issuanceAPI.getAssignments(validId);
                const savedRows = response?.data || response || [];

                if (Array.isArray(savedRows) && savedRows.length > 0) {
                    const loaded = savedRows.map((dbRow: any) => {
                        // Match incoming historic DB IDs back to their UI labels
                        const foundMatch = availableItems.find(ai =>
                            ai.allDetailIds.includes(Number(dbRow.issuance_detail_id))
                        );

                        return {
                            id: uid(),
                            receiver_name: dbRow.receiver_name || '',
                            issuance_detail_id: foundMatch ? foundMatch.id : '',
                            quantity: Number(dbRow.quantity || 1),
                            isDropdownOpen: false,
                            searchQuery: ''
                        };
                    });
                    setRows(loaded);
                } else {
                    setRows([
                        { id: uid(), receiver_name: '', issuance_detail_id: '', quantity: 1, isDropdownOpen: false, searchQuery: '' }
                    ]);
                }
            } catch (err) {
                console.error("Failed fetching saved indices:", err);
                setRows([
                    { id: uid(), receiver_name: '', issuance_detail_id: '', quantity: 1, isDropdownOpen: false, searchQuery: '' }
                ]);
            } finally {
                setLoadingHistory(false);
            }
        }

        loadSavedAssignments(issuanceId);
    }, [open, issuanceId, availableItems]);

    const getAssignedQtySumExceptRow = (itemId: string, excludeRowId?: string, currentRowsList: AssignmentRow[] = rows) => {
        return currentRowsList
            .filter(r => r.issuance_detail_id === itemId && r.id !== excludeRowId)
            .reduce((sum, r) => sum + r.quantity, 0);
    };

    const addAssignmentRow = () => {
        setRows(prev => [...prev, { id: uid(), receiver_name: '', issuance_detail_id: '', quantity: 1, isDropdownOpen: false, searchQuery: '' }]);
    };

    const removeAssignmentRow = (id: string) => {
        setRows(prev => prev.filter(r => r.id !== id));
    };

    const updateRow = (id: string, patch: Partial<Omit<AssignmentRow, 'id'>>) => {
        setRows(prev => {
            return prev.map(row => {
                if (row.id !== id) return row;

                const updatedRow = { ...row, ...patch };

                if (patch.issuance_detail_id !== undefined && updatedRow.issuance_detail_id !== '') {
                    const targetItem = availableItems.find(i => i.id === updatedRow.issuance_detail_id);
                    if (targetItem) {
                        const alreadyAssigned = getAssignedQtySumExceptRow(targetItem.id, id, prev);
                        const remainingAllowed = targetItem.maxQty - alreadyAssigned;
                        updatedRow.quantity = Math.max(1, remainingAllowed);
                    }
                } else if (updatedRow.issuance_detail_id !== '') {
                    const targetItem = availableItems.find(i => i.id === updatedRow.issuance_detail_id);
                    if (targetItem) {
                        const alreadyAssigned = getAssignedQtySumExceptRow(targetItem.id, id, prev);
                        const remainingAllowed = targetItem.maxQty - alreadyAssigned;
                        if (updatedRow.quantity > remainingAllowed) {
                            updatedRow.quantity = Math.max(1, remainingAllowed);
                        }
                    }
                }

                return updatedRow;
            });
        });
    };

    const validate = (): { ok: boolean; message?: string } => {
        if (rows.length === 0) return { ok: false, message: 'Please add at least one receiver assignment.' };

        for (const r of rows) {
            if (!r.receiver_name.trim()) return { ok: false, message: 'All rows must have a valid Receiver Name.' };
            if (r.issuance_detail_id === '') return { ok: false, message: `Please select an item for receiver "${r.receiver_name}".` };
            if (r.quantity < 1) return { ok: false, message: `Quantity for "${r.receiver_name}" must be at least 1.` };
        }

        for (const item of availableItems) {
            const totalAssigned = rows
                .filter(r => r.issuance_detail_id === item.id)
                .reduce((sum, r) => sum + r.quantity, 0);

            if (!allowPartialPrint) {
                if (totalAssigned !== item.maxQty) {
                    return {
                        ok: false,
                        message: `Item "${item.label}" mismatch. Assigned ${totalAssigned} out of ${item.maxQty} required units.`
                    };
                }
            } else {
                if (totalAssigned > item.maxQty) {
                    return {
                        ok: false,
                        message: `Item "${item.label}" is over-allocated (${totalAssigned}/${item.maxQty}).`
                    };
                }
            }
        }
        return { ok: true };
    };

    const handleSave = async () => {
        if (!issuanceId) {
            toast.error('Missing target Issuance Identification ID.');
            return;
        }

        const v = validate();
        if (!v.ok) { toast.error(v.message || 'Validation failed'); return; }

        // Process combined item rows safely back into single database records for processing updates
        const finalAssignments: Array<{ issuance_detail_id: number; receiver_name: string; quantity: number }> = [];

        availableItems.forEach(item => {
            const relevantRows = rows.filter(r => r.issuance_detail_id === item.id);
            if (relevantRows.length === 0) return;

            let detailsPool = [...item.allDetailIds];

            relevantRows.forEach(row => {
                let assignedCountForUser = row.quantity;

                while (assignedCountForUser > 0 && detailsPool.length > 0) {
                    const activeDetailId = detailsPool[0];

                    // Discover total stock capacity for individual components from raw structural data
                    const sourceItems = items.filter(it => it.IssuanceDetailID === activeDetailId);
                    const sourceQty = sourceItems.reduce((acc, it) => acc + Math.max(1, Number(it.QuantityIssued ?? 1)), 0);

                    const alreadySavedFromActive = finalAssignments
                        .filter(f => f.issuance_detail_id === activeDetailId)
                        .reduce((sum, f) => sum + f.quantity, 0);

                    const capacityRemaining = sourceQty - alreadySavedFromActive;

                    if (capacityRemaining <= 0) {
                        detailsPool.shift();
                        continue;
                    }

                    const takeAmount = Math.min(assignedCountForUser, capacityRemaining);

                    finalAssignments.push({
                        issuance_detail_id: activeDetailId,
                        receiver_name: row.receiver_name.trim(),
                        quantity: takeAmount
                    });

                    assignedCountForUser -= takeAmount;
                    if (takeAmount === capacityRemaining) {
                        detailsPool.shift();
                    }
                }
            });
        });

        try {
            setSaving(true);
            await issuanceAPI.saveAssignments(issuanceId, { assignments: finalAssignments });
            toast.success('Receiver assignments saved successfully!');
            onOpenChange(false);
            onSaved?.();
        } catch (err) {
            toast.error('Failed to update asset assignments.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40" />
                <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl w-full max-w-5xl p-6 flex flex-col max-h-[90vh]">

                    <div className="border-b border-slate-100 pb-3 mb-4">
                        <Dialog.Title className="text-xl font-bold text-slate-900">Assign Items to Receivers</Dialog.Title>
                        <Dialog.Description className="text-slate-500 text-sm mt-1">
                            Select a receiver first, search/select their item assignment, and distribute the quantities.
                        </Dialog.Description>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4 text-sm">
                        <label className="flex items-center gap-2 font-medium text-slate-700 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                className="w-4 h-4 accent-[var(--primary)] rounded cursor-pointer"
                                checked={allowPartialPrint}
                                onChange={(e) => setAllowPartialPrint(e.target.checked)}
                            />
                            Allow Partial Print / Remaining Adjustments
                        </label>
                        <button
                            type="button"
                            onClick={addAssignmentRow}
                            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg transition-colors shadow-xs"
                        >
                            + Add Receiver Allocation
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-[300px] pb-32">
                        {loadingHistory ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-sm italic">
                                <svg className="animate-spin h-6 w-6 text-slate-500 mb-2.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Syncing saved receiver configurations...
                            </div>
                        ) : (
                            rows.map((row, idx) => {
                                const chosenItem = availableItems.find(i => i.id === row.issuance_detail_id);
                                const collectiveUsed = chosenItem ? getAssignedQtySumExceptRow(chosenItem.id, row.id) : 0;
                                const remainingAvailable = chosenItem ? (chosenItem.maxQty - collectiveUsed) : 0;

                                const currentQuery = row.searchQuery || '';
                                const filteredItems = availableItems.filter(item => {
                                    const labelString = item.label || '';
                                    return labelString.toLowerCase().includes(currentQuery.toLowerCase());
                                });

                                return (
                                    <div key={row.id} className="flex flex-col md:flex-row items-start md:items-center gap-3 p-4 border border-slate-200 hover:border-slate-300 rounded-xl bg-white transition-all shadow-xs relative">
                                        <span className="absolute -left-2 top-1/2 -translate-y-1/2 bg-slate-100 text-slate-500 text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border border-slate-200">
                                            {idx + 1}
                                        </span>

                                        <div className="w-full md:flex-1 pl-2">
                                            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Receiver Name</label>
                                            <input
                                                type="text"
                                                value={row.receiver_name || ''}
                                                onChange={(e) => updateRow(row.id, { receiver_name: e.target.value })}
                                                placeholder="Enter complete name..."
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--primary)] outline-hidden font-medium text-slate-800"
                                            />
                                        </div>

                                        <div className="w-full md:w-[360px] relative">
                                            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Assigned Asset Item</label>

                                            <div
                                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white cursor-pointer flex items-center justify-between font-medium text-slate-800 min-h-[38px]"
                                                onClick={() => updateRow(row.id, { isDropdownOpen: !row.isDropdownOpen })}
                                            >
                                                <span className={chosenItem ? "text-slate-800 truncate block max-w-[300px]" : "text-slate-400 font-normal"}>
                                                    {chosenItem ? chosenItem.label : "-- Search & Select Asset Item --"}
                                                </span>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-400 shrink-0 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>

                                            {row.isDropdownOpen && (
                                                <>
                                                    <div className="fixed inset-0 z-10" onClick={() => updateRow(row.id, { isDropdownOpen: false })} />
                                                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-20 flex flex-col max-h-[280px]">
                                                        <div className="p-2 border-b border-slate-100 bg-slate-50 sticky top-0">
                                                            <input
                                                                type="text"
                                                                autoFocus
                                                                placeholder="Type to filter items..."
                                                                value={row.searchQuery || ''}
                                                                onChange={(e) => updateRow(row.id, { searchQuery: e.target.value })}
                                                                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-[var(--primary)] bg-white font-medium"
                                                            />
                                                        </div>

                                                        <div className="overflow-y-auto max-h-60 divide-y divide-slate-50">
                                                            {filteredItems.length === 0 ? (
                                                                <div className="p-3 text-xs text-slate-400 italic text-center">No matching items found</div>
                                                            ) : (
                                                                filteredItems.map((item) => {
                                                                    const totalItemUsedElsewhere = getAssignedQtySumExceptRow(item.id, row.id);
                                                                    const itemRemaining = item.maxQty - totalItemUsedElsewhere;
                                                                    const isCurrentlySelected = row.issuance_detail_id === item.id;

                                                                    return (
                                                                        <button
                                                                            key={item.id}
                                                                            type="button"
                                                                            disabled={itemRemaining <= 0 && !isCurrentlySelected}
                                                                            onClick={() => {
                                                                                updateRow(row.id, {
                                                                                    issuance_detail_id: item.id,
                                                                                    isDropdownOpen: false,
                                                                                    searchQuery: ''
                                                                                });
                                                                            }}
                                                                            className={`w-full text-left px-3 py-2 text-xs transition-colors flex flex-col gap-0.5 ${isCurrentlySelected ? 'bg-slate-100 text-[var(--primary)] font-bold' : 'hover:bg-slate-50 text-slate-700'
                                                                                } ${itemRemaining <= 0 && !isCurrentlySelected ? 'opacity-40 cursor-not-allowed bg-slate-50' : ''}`}
                                                                        >
                                                                            <span className="font-medium truncate block">{item.label}</span>
                                                                            <span className="text-[10px] text-slate-400">
                                                                                Available Remaining: <strong className={itemRemaining > 0 ? "text-emerald-600" : "text-rose-500"}>{itemRemaining}</strong> / {item.maxQty}
                                                                            </span>
                                                                        </button>
                                                                    );
                                                                })
                                                            )}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        <div className="w-full md:w-[110px]">
                                            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Quantity</label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={chosenItem ? (remainingAvailable) : undefined}
                                                disabled={row.issuance_detail_id === ''}
                                                value={row.quantity}
                                                onChange={(e) => updateRow(row.id, { quantity: Math.max(1, Number(e.target.value || 0)) })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-center font-bold focus:ring-2 focus:ring-[var(--primary)] outline-hidden bg-slate-50 text-slate-900 disabled:opacity-40"
                                            />
                                        </div>

                                        <div className="w-full md:w-[140px] text-center md:text-left">
                                            {chosenItem ? (
                                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-center px-2">
                                                    <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Remaining Pool</div>
                                                    <div className={`text-xs font-extrabold ${remainingAvailable - row.quantity === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                        {remainingAvailable - row.quantity} Left / {chosenItem.maxQty}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-xs text-slate-400 italic text-center py-2">Select an item</div>
                                            )}
                                        </div>

                                        <div className="w-full md:w-auto flex justify-end md:pt-4">
                                            <button
                                                type="button"
                                                onClick={() => removeAssignmentRow(row.id)}
                                                disabled={rows.length === 1}
                                                className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30"
                                                title="Delete Row"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>

                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div className="border-t border-slate-100 pt-4 mt-auto flex justify-end gap-2.5 bg-white z-10">
                        <Dialog.Close asChild>
                            <button className="px-5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-sm transition-colors">
                                Cancel
                            </button>
                        </Dialog.Close>
                        <button
                            onClick={handleSave}
                            disabled={saving || loadingHistory}
                            className="px-5 py-2 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-semibold text-sm transition-colors shadow-md disabled:opacity-50"
                        >
                            {saving ? 'Processing...' : 'Save Assignments & Print'}
                        </button>
                    </div>

                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
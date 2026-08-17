import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import issuanceAPI from '@/lib/api/issuance';
import { toast } from 'sonner';

interface AssignmentRow {
    id: string;
    receiver_name: string;
    position_office?: string;
    issuance_detail_id: string;
    quantity: number;
    isDropdownOpen?: boolean;
    searchQuery: string;
}

export interface AssignReceiversModalItem {
    IssuanceDetailID: number;
    ItemDescription?: string | null;
    QuantityIssued?: number | null;
    Article?: string | null;
    Brand?: string | null;
    ModelNumber?: string | null;
    SerialNumber?: string | null;
}

export interface AssignReceiversSaveResult {
    assignments: Array<{ receiver_name: string; position_office?: string; detailIds: number[] }>;
    documentType?: 'PAR' | 'ICS';
}

interface Props {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    issuanceId: number | null;
    documentType?: 'PAR' | 'ICS';
    items: AssignReceiversModalItem[];
    onSaved?: (result: AssignReceiversSaveResult) => void;
    onPreparePrintTabs?: (
        assignments: Array<{ receiver_name: string; position_office?: string }>,
        issuanceId: number,
    ) => { windows: Array<Window | null>; urls: string[] } | undefined;
    onCustomLoad?: (id: number) => Promise<Array<{ issuance_detail_id: number; receiver_name: string; position_office?: string; quantity: number }>>;
    onCustomSave?: (id: number, assignments: Array<{ issuance_detail_id: number; receiver_name: string; position_office?: string; quantity: number }>) => Promise<void>;
}

function uid() { return Math.random().toString(36).slice(2, 9); }

export default function AssignReceiversModal({ open, onOpenChange, issuanceId, documentType, items, onSaved, onCustomLoad, onCustomSave, onPreparePrintTabs }: Props) {
    const [rows, setRows] = React.useState<AssignmentRow[]>([]);
    const [saving, setSaving] = React.useState(false);
    const [savingRows, setSavingRows] = React.useState<Record<string, boolean>>({});
    const [loadingHistory, setLoadingHistory] = React.useState(false);
    const scrollRef = React.useRef<HTMLDivElement>(null);

    const availableItems = React.useMemo(() => {
        const itemMap: Record<string, { ids: number[]; label: string; maxQty: number }> = {};
        (items || []).forEach(it => {
            const groupKey = [
                (it.Article || '').trim(),
                (it.ItemDescription || '').trim(),
                (it.Brand || '').trim(),
                (it.ModelNumber || '').trim(),
            ].join('|');
            const label = [it.Article, it.Brand, it.ModelNumber].filter(Boolean).join(' · ') || (it.ItemDescription || 'Item');
            const itemQty = Math.max(1, Number(it.QuantityIssued ?? 1));
            if (itemMap[groupKey]) {
                itemMap[groupKey].maxQty += itemQty;
                if (!itemMap[groupKey].ids.includes(it.IssuanceDetailID)) itemMap[groupKey].ids.push(it.IssuanceDetailID);
            } else {
                itemMap[groupKey] = { ids: [it.IssuanceDetailID], label, maxQty: itemQty };
            }
        });
        return Object.values(itemMap).map(group => ({ id: group.label, allDetailIds: group.ids, label: group.label, maxQty: group.maxQty }));
    }, [items]);

    React.useEffect(() => {
        if (!open || !issuanceId) return;
        async function loadSavedAssignments(validId: number) {
            try {
                setLoadingHistory(true);
                const response = onCustomLoad ? await onCustomLoad(validId) : await issuanceAPI.getAssignments(validId);
                const savedRows = Array.isArray(response) ? response : (response?.data || response || []);
                if (Array.isArray(savedRows) && savedRows.length > 0) {
                    const aggregatedMap: Record<string, { receiver_name: string; position_office: string; issuance_detail_id: string; quantity: number }> = {};
                    savedRows.forEach((dbRow: any) => {
                        const foundMatch = availableItems.find(ai => ai.allDetailIds.includes(Number(dbRow.issuance_detail_id)));
                        const itemUiId = foundMatch ? foundMatch.id : '';
                        const receiverName = (dbRow.receiver_name || '').trim();
                        const positionOffice = (dbRow.position_office || '').trim();
                        const groupingKey = `${receiverName}_${positionOffice}_${itemUiId}`;
                        const qty = Number(dbRow.quantity || 1);
                        if (aggregatedMap[groupingKey]) aggregatedMap[groupingKey].quantity += qty;
                        else aggregatedMap[groupingKey] = { receiver_name: receiverName, position_office: positionOffice, issuance_detail_id: itemUiId, quantity: qty };
                    });
                    setRows(Object.values(aggregatedMap).map(group => ({ id: uid(), receiver_name: group.receiver_name, position_office: group.position_office, issuance_detail_id: group.issuance_detail_id, quantity: group.quantity, isDropdownOpen: false, searchQuery: '' })));
                } else {
                    setRows([{ id: uid(), receiver_name: '', position_office: '', issuance_detail_id: '', quantity: 1, isDropdownOpen: false, searchQuery: '' }]);
                }
            } catch (err) {
                console.error("Failed fetching saved indices:", err);
                setRows([{ id: uid(), receiver_name: '', issuance_detail_id: '', quantity: 1, isDropdownOpen: false, searchQuery: '' }]);
            } finally {
                setLoadingHistory(false);
            }
        }
        loadSavedAssignments(issuanceId);
    }, [open, issuanceId, availableItems]);

    const getAssignedQtySumExceptRow = (itemId: string, excludeRowId?: string, currentRowsList: AssignmentRow[] = rows) =>
        currentRowsList.filter(r => r.issuance_detail_id === itemId && r.id !== excludeRowId).reduce((sum, r) => sum + r.quantity, 0);

    const addAssignmentRow = () => {
        setRows(prev => [...prev, { id: uid(), receiver_name: '', position_office: '', issuance_detail_id: '', quantity: 1, isDropdownOpen: false, searchQuery: '' }]);
        setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50);
    };

    const addItemForReceiver = (currentReceiverName: string, currentPositionOffice?: string) => {
        setRows(prev => [...prev, { id: uid(), receiver_name: currentReceiverName, position_office: currentPositionOffice || '', issuance_detail_id: '', quantity: 1, isDropdownOpen: false, searchQuery: '' }]);
        setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50);
    };

    const removeAssignmentRow = (id: string) => setRows(prev => prev.filter(r => r.id !== id));

    const updateRow = (id: string, patch: Partial<Omit<AssignmentRow, 'id'>>) => {
        setRows(prev => prev.map(row => {
            if (row.id !== id) return row;
            const updatedRow = { ...row, ...patch };
            if (patch.issuance_detail_id !== undefined && updatedRow.issuance_detail_id !== '') {
                const targetItem = availableItems.find(i => i.id === updatedRow.issuance_detail_id);
                if (targetItem) {
                    const alreadyAssigned = getAssignedQtySumExceptRow(targetItem.id, id, prev);
                    updatedRow.quantity = Math.max(1, targetItem.maxQty - alreadyAssigned);
                }
            } else if (updatedRow.issuance_detail_id !== '') {
                const targetItem = availableItems.find(i => i.id === updatedRow.issuance_detail_id);
                if (targetItem) {
                    const remainingAllowed = targetItem.maxQty - getAssignedQtySumExceptRow(targetItem.id, id, prev);
                    if (updatedRow.quantity > remainingAllowed) updatedRow.quantity = Math.max(1, remainingAllowed);
                }
            }
            return updatedRow;
        }));
    };

    const validate = (): { ok: boolean; message?: string } => {
        if (rows.length === 0) return { ok: false, message: 'Please add at least one receiver assignment.' };
        for (const r of rows) {
            if (!r.receiver_name.trim()) return { ok: false, message: 'All rows must have a valid Receiver Name.' };
            if (r.issuance_detail_id === '') return { ok: false, message: `Please select an item for receiver "${r.receiver_name}".` };
            if (r.quantity < 1) return { ok: false, message: `Quantity for "${r.receiver_name}" must be at least 1.` };
        }
        for (const item of availableItems) {
            const totalAssigned = rows.filter(r => r.issuance_detail_id === item.id).reduce((sum, r) => sum + r.quantity, 0);
            if (totalAssigned > item.maxQty) return { ok: false, message: `Item "${item.label}" is over-allocated (${totalAssigned}/${item.maxQty}).` };
        }
        return { ok: true };
    };

    const buildFinalAssignments = (targetRows: AssignmentRow[]) => {
        const finalAssignments: Array<{ issuance_detail_id: number; receiver_name: string; position_office?: string; quantity: number }> = [];
        availableItems.forEach(item => {
            const relevantRows = targetRows.filter(r => r.issuance_detail_id === item.id);
            if (!relevantRows.length) return;
            const detailsPool = [...item.allDetailIds];
            relevantRows.forEach(row => {
                let remaining = row.quantity;
                while (remaining > 0 && detailsPool.length > 0) {
                    const activeDetailId = detailsPool[0];
                    const sourceQty = items.filter(it => it.IssuanceDetailID === activeDetailId).reduce((acc, it) => acc + Math.max(1, Number(it.QuantityIssued ?? 1)), 0);
                    const alreadySaved = finalAssignments.filter(f => f.issuance_detail_id === activeDetailId).reduce((sum, f) => sum + f.quantity, 0);
                    const capacity = sourceQty - alreadySaved;
                    if (capacity <= 0) { detailsPool.shift(); continue; }
                    const take = Math.min(remaining, capacity);
                    finalAssignments.push({ issuance_detail_id: activeDetailId, receiver_name: row.receiver_name.trim(), position_office: (row.position_office || '').trim(), quantity: take });
                    remaining -= take;
                    if (take === capacity) detailsPool.shift();
                }
            });
        });
        return finalAssignments;
    };

    const buildAssignmentGroups = (finalAssignments: ReturnType<typeof buildFinalAssignments>) => {
        const grouping: Record<string, { detailIds: Set<number>; position_office?: string }> = {};
        finalAssignments.forEach(a => {
            const key = `${a.receiver_name.trim()}||${a.position_office || ''}`;
            if (!grouping[key]) grouping[key] = { detailIds: new Set<number>(), position_office: a.position_office };
            grouping[key].detailIds.add(Number(a.issuance_detail_id));
        });
        return Object.keys(grouping).map(key => {
            const [receiver_name] = key.split('||');
            return { receiver_name, position_office: grouping[key].position_office, detailIds: Array.from(grouping[key].detailIds) };
        });
    };

    const handlePrintTabs = (assignments: ReturnType<typeof buildAssignmentGroups>, success: boolean) => {
        const printTabTargets = onPreparePrintTabs?.(assignments.map(a => ({ receiver_name: a.receiver_name, position_office: a.position_office })), issuanceId!) ?? { windows: [], urls: [] };
        if (!printTabTargets.windows?.length) return;
        if (!success) { printTabTargets.windows.forEach(win => { if (win && !win.closed) win.close(); }); return; }
        printTabTargets.windows.forEach((win, idx) => { const url = printTabTargets.urls[idx]; if (win && !win.closed && url) win.location.href = url; });
    };

    const handleSave = async () => {
        if (!issuanceId) { toast.error('Missing target Issuance Identification ID.'); return; }
        const v = validate();
        if (!v.ok) { toast.error(v.message || 'Validation failed'); return; }
        const finalAssignments = buildFinalAssignments(rows);
        const assignments = buildAssignmentGroups(finalAssignments);
        try {
            setSaving(true);
            if (onCustomSave) await onCustomSave(issuanceId!, finalAssignments);
            else await issuanceAPI.saveAssignments(issuanceId!, { assignments: finalAssignments });
            toast.success('Receiver assignments saved successfully!');
            handlePrintTabs(assignments, true);
            onSaved?.({ assignments, documentType });
            onOpenChange(false);
        } catch {
            toast.error('Failed to update asset assignments.');
            handlePrintTabs(assignments, false);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveRow = async (rowId: string) => {
        if (!issuanceId) { toast.error('Missing target Issuance Identification ID.'); return; }
        const row = rows.find(r => r.id === rowId);
        if (!row) { toast.error('Receiver row not found.'); return; }
        if (!row.receiver_name.trim()) { toast.error('Receiver name is required.'); return; }
        if (row.issuance_detail_id === '') { toast.error(`Please select an item for receiver "${row.receiver_name}".`); return; }
        if (row.quantity < 1) { toast.error('Quantity must be at least 1.'); return; }
        const chosenItem = availableItems.find(i => i.id === row.issuance_detail_id);
        if (!chosenItem) { toast.error('Assigned item invalid.'); return; }
        const remaining = chosenItem.maxQty - getAssignedQtySumExceptRow(chosenItem.id, row.id);
        if (row.quantity > remaining) { toast.error('Requested quantity exceeds available remaining.'); return; }
        const finalAssignments = buildFinalAssignments([row]);
        if (!finalAssignments.length) { toast.error('No available item quantity to assign.'); return; }
        const assignments = buildAssignmentGroups(finalAssignments);
        try {
            setSavingRows(prev => ({ ...prev, [rowId]: true }));
            if (onCustomSave) await onCustomSave(issuanceId!, finalAssignments);
            else await issuanceAPI.saveAssignments(issuanceId!, { assignments: finalAssignments });
            toast.success('Receiver assignment saved!');
            handlePrintTabs(assignments, true);
            onSaved?.({ assignments, documentType });
        } catch {
            toast.error('Failed to save receiver assignment.');
            handlePrintTabs(assignments, false);
        } finally {
            setSavingRows(prev => ({ ...prev, [rowId]: false }));
        }
    };

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" />
                {/* ↑ taller: h-[95vh], wider: max-w-[92vw], grid layout to lock header/footer */}
                <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl w-full max-w-[92vw] h-[95vh] flex flex-col overflow-hidden">

                    {/* ── Header ── */}
                    <div className="flex-none border-b border-slate-100 px-6 py-4">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <Dialog.Title className="text-lg font-bold text-slate-900 leading-tight">
                                    Assign Items to Receivers
                                    {documentType && <span className="ml-2 text-sm font-semibold text-slate-400">({documentType})</span>}
                                </Dialog.Title>
                                <Dialog.Description className="text-slate-500 text-xs mt-0.5">
                                    Select receivers, assign items, and distribute quantities. Only assigned items appear on the print view.
                                </Dialog.Description>
                            </div>
                            <button
                                type="button"
                                onClick={addAssignmentRow}
                                className="shrink-0 px-4 py-2 bg-slate-900 hover:bg-slate-700 text-white font-semibold text-xs rounded-lg transition-colors shadow-sm whitespace-nowrap"
                            >
                                + Add Receiver
                            </button>
                        </div>

                        {/* Item pool summary strip */}
                        {availableItems.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                                {availableItems.map(item => {
                                    const used = rows.filter(r => r.issuance_detail_id === item.id).reduce((s, r) => s + r.quantity, 0);
                                    const left = item.maxQty - used;
                                    return (
                                        <span key={item.id} className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${left === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                                            {item.label}
                                            <span className={`font-bold ${left === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>{left}/{item.maxQty}</span>
                                        </span>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* ── Scrollable body ── */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                        {loadingHistory ? (
                            <div className="flex flex-col items-center justify-center py-24 text-slate-400 text-sm">
                                <svg className="animate-spin h-6 w-6 text-slate-400 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Syncing saved receiver configurations...
                            </div>
                        ) : (
                            rows.map((row, idx) => {
                                const chosenItem = availableItems.find(i => i.id === row.issuance_detail_id);
                                const collectiveUsed = chosenItem ? getAssignedQtySumExceptRow(chosenItem.id, row.id) : 0;
                                const remainingAvailable = chosenItem ? chosenItem.maxQty - collectiveUsed : 0;
                                const filteredItems = availableItems.filter(item => (item.label || '').toLowerCase().includes((row.searchQuery || '').toLowerCase()));

                                return (
                                    <div key={row.id} className="relative border border-slate-200 hover:border-slate-300 rounded-xl bg-white shadow-xs transition-all">
                                        {/* Row number badge */}
                                        <div className="absolute -top-2.5 left-3 bg-slate-800 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                            #{idx + 1}
                                        </div>

                                        {/* Top section: receiver info */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-4 pt-5 pb-3 border-b border-slate-100">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Receiver Name *</label>
                                                <input
                                                    type="text"
                                                    value={row.receiver_name || ''}
                                                    onChange={e => updateRow(row.id, { receiver_name: e.target.value })}
                                                    placeholder="Enter complete name..."
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--primary)] outline-none font-medium text-slate-800"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Position / Office</label>
                                                <input
                                                    type="text"
                                                    value={row.position_office || ''}
                                                    onChange={e => updateRow(row.id, { position_office: e.target.value })}
                                                    placeholder="e.g. Admin Officer, Admin Aide"
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--primary)] outline-none font-medium text-slate-800"
                                                />
                                            </div>
                                        </div>

                                        {/* Bottom section: item + qty + actions */}
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 px-4 py-3">

                                            {/* Item dropdown — takes most space */}
                                            <div className="flex-1 w-full relative">
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Assigned Asset Item *</label>
                                                <div
                                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white cursor-pointer flex items-center justify-between font-medium text-slate-800 min-h-[38px] hover:border-slate-400 transition-colors"
                                                    onClick={() => updateRow(row.id, { isDropdownOpen: !row.isDropdownOpen })}
                                                >
                                                    <span className={chosenItem ? 'text-slate-800 break-words' : 'text-slate-400 font-normal'}>
                                                        {chosenItem ? chosenItem.label : '— Search & select item —'}
                                                    </span>
                                                    <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 text-slate-400 shrink-0 ml-2 transition-transform ${row.isDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </div>

                                                {row.isDropdownOpen && (
                                                    <>
                                                        <div className="fixed inset-0 z-10" onClick={() => updateRow(row.id, { isDropdownOpen: false })} />
                                                        <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-20 flex flex-col overflow-hidden" style={{ maxHeight: 280 }}>
                                                            <div className="p-2 border-b border-slate-100 bg-slate-50">
                                                                <input
                                                                    type="text"
                                                                    autoFocus
                                                                    placeholder="Type to filter..."
                                                                    value={row.searchQuery || ''}
                                                                    onChange={e => updateRow(row.id, { searchQuery: e.target.value })}
                                                                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-white"
                                                                />
                                                            </div>
                                                            <div className="overflow-y-auto divide-y divide-slate-100">
                                                                {filteredItems.length === 0 ? (
                                                                    <div className="p-3 text-xs text-slate-400 italic text-center">No matching items</div>
                                                                ) : filteredItems.map(item => {
                                                                    const usedElsewhere = getAssignedQtySumExceptRow(item.id, row.id);
                                                                    const itemLeft = item.maxQty - usedElsewhere;
                                                                    const isSelected = row.issuance_detail_id === item.id;
                                                                    return (
                                                                        <button
                                                                            key={item.id}
                                                                            type="button"
                                                                            disabled={itemLeft <= 0 && !isSelected}
                                                                            onClick={() => updateRow(row.id, { issuance_detail_id: item.id, isDropdownOpen: false, searchQuery: '' })}
                                                                            className={`w-full text-left px-3 py-2.5 text-xs flex items-center justify-between gap-2 transition-colors ${isSelected ? 'bg-[var(--primary)]/10 text-[var(--primary)] font-bold' : 'hover:bg-slate-50 text-slate-700'} ${itemLeft <= 0 && !isSelected ? 'opacity-40 cursor-not-allowed' : ''}`}
                                                                        >
                                                                            <span className="font-medium break-words">{item.label}</span>
                                                                            <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${itemLeft > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
                                                                                {itemLeft}/{item.maxQty}
                                                                            </span>
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            {/* Qty */}
                                            <div className="w-full sm:w-24 shrink-0">
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Qty</label>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={remainingAvailable}
                                                    disabled={!row.issuance_detail_id}
                                                    value={row.quantity}
                                                    onChange={e => updateRow(row.id, { quantity: Math.max(1, Number(e.target.value || 0)) })}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-center font-bold focus:ring-2 focus:ring-[var(--primary)] outline-none bg-slate-50 text-slate-900 disabled:opacity-40"
                                                />
                                            </div>

                                            {/* Pool badge */}
                                            <div className="w-full sm:w-28 shrink-0">
                                                {chosenItem ? (
                                                    <div className={`rounded-lg px-3 py-2 text-center border ${(remainingAvailable - row.quantity) === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                                                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Pool Left</div>
                                                        <div className={`text-sm font-extrabold ${(remainingAvailable - row.quantity) === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                            {remainingAvailable - row.quantity}/{chosenItem.maxQty}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-slate-300 italic text-center pt-3">—</div>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-1 shrink-0 sm:pt-5">
                                                <button
                                                    type="button"
                                                    disabled={!row.receiver_name.trim()}
                                                    onClick={() => addItemForReceiver(row.receiver_name, row.position_office)}
                                                    title="Add another item for this receiver"
                                                    className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-30"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                    </svg>
                                                </button>

                                                <button
                                                    type="button"
                                                    disabled={!row.receiver_name.trim() || !row.issuance_detail_id || savingRows[row.id]}
                                                    onClick={() => handleSaveRow(row.id)}
                                                    className="px-3 py-1.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-semibold text-xs rounded-lg transition-colors disabled:opacity-40 whitespace-nowrap"
                                                >
                                                    {savingRows[row.id] ? '...' : 'Save & Print'}
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => removeAssignmentRow(row.id)}
                                                    disabled={rows.length === 1}
                                                    title="Remove row"
                                                    className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-30"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* ── Footer ── */}
                    <div className="flex-none border-t border-slate-100 px-6 py-4 flex items-center justify-between bg-white">
                        <span className="text-xs text-slate-400">
                            {rows.length} receiver row{rows.length !== 1 ? 's' : ''}
                        </span>
                        <div className="flex gap-2">
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
                                {saving ? 'Processing...' : 'Save All & Print'}
                            </button>
                        </div>
                    </div>

                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
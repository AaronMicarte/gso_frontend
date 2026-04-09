'use client';

import { type ComponentType, Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, CheckCircle2, ChevronDown, ChevronRight, Gift, Gavel, HandCoins, Recycle, RefreshCw, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import propertyWasteApi from '@/lib/api/propertyWaste';
import type { PropertyWasteDisposalMethod, PropertyWasteItem, PropertyWasteItemStatus, PropertyWasteReport } from '@/types/propertyWaste';

interface PropertyWastePageProps {
    title: string;
    description: string;
    canManage: boolean;
}

const itemStatusClasses: Record<PropertyWasteItemStatus, string> = {
    pending_method: 'bg-slate-100 text-slate-700',
    method_selected: 'bg-indigo-100 text-indigo-800',
    for_disposal: 'bg-amber-100 text-amber-800',
    disposed: 'bg-emerald-100 text-emerald-800',
};

const iconByKey: Record<string, ComponentType<{ className?: string }>> = {
    gavel: Gavel,
    gift: Gift,
    recycle: Recycle,
    'hand-coins': HandCoins,
    'badge-dollar-sign': HandCoins,
    'trash-2': Trash2,
};

const statusLabel = (value: string) => value.replaceAll('_', ' ');

export function PropertyWastePage({ title, description, canManage }: PropertyWastePageProps) {
    const [rows, setRows] = useState<PropertyWasteReport[]>([]);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isFetching, setIsFetching] = useState(false);

    const [expandedReports, setExpandedReports] = useState<Record<number, boolean>>({});
    const [disposalMethods, setDisposalMethods] = useState<PropertyWasteDisposalMethod[]>([]);
    const [editingMethodId, setEditingMethodId] = useState<number | ''>('');
    const [editingMethodNote, setEditingMethodNote] = useState('');
    const [methodModalOpen, setMethodModalOpen] = useState(false);
    const [modalTarget, setModalTarget] = useState<{ reportId: number; item: PropertyWasteItem } | null>(null);
    const [confirmDoneTarget, setConfirmDoneTarget] = useState<{ reportId: number; wasteNumber: string; itemCount: number } | null>(null);
    const [confirmingDone, setConfirmingDone] = useState(false);
    const [reportNotesDraft, setReportNotesDraft] = useState<Record<number, string>>({});
    const [savingNotesByReportId, setSavingNotesByReportId] = useState<Record<number, boolean>>({});

    const load = useCallback(async (targetPage = 1) => {
        try {
            setIsFetching(true);
            const response = await propertyWasteApi.getAll({
                page: targetPage,
                per_page: 15,
                search: search || undefined,
            });

            setRows(response.data ?? []);
            setPage(response.current_page ?? 1);
            setLastPage(response.last_page ?? 1);
        } catch {
            toast.error('Failed to load property waste records');
        } finally {
            setIsFetching(false);
            setIsInitialLoading(false);
        }
    }, [search]);

    useEffect(() => {
        load(1);
    }, [load]);

    useEffect(() => {
        propertyWasteApi
            .getDisposalMethods()
            .then(setDisposalMethods)
            .catch(() => {
                toast.error('Failed to load disposal methods');
            });
    }, []);

    useEffect(() => {
        setReportNotesDraft((prev) => {
            const next = { ...prev };
            for (const report of rows) {
                if (next[report.PropertyWasteReportID] === undefined) {
                    next[report.PropertyWasteReportID] = report.Notes ?? '';
                }
            }
            return next;
        });
    }, [rows]);

    const reportCounts = useMemo(() => {
        return rows.reduce(
            (acc, report) => {
                acc.total += 1;
                if ((report.items ?? []).every((item) => item.Status === 'disposed')) {
                    acc.done += 1;
                } else {
                    acc.inProgress += 1;
                }
                return acc;
            },
            {
                total: 0,
                inProgress: 0,
                done: 0,
            }
        );
    }, [rows]);

    const markReportDone = async (report: PropertyWasteReport) => {
        const items = report.items ?? [];
        if (items.length === 0) {
            toast.error('This waste report has no items to complete.');
            return;
        }

        const missingMethod = items.some((item) => !item.DisposalMethodID);
        if (missingMethod) {
            toast.error('Select disposal methods for all items before marking this report done.');
            return;
        }

        try {
            await propertyWasteApi.update(report.PropertyWasteReportID, {
                status: 'completed',
                items: items.map((item) => ({
                    property_waste_item_id: item.PropertyWasteItemID,
                    status: 'disposed',
                })),
            });
            toast.success('Disposal marked as done.');
            await load(page);
        } catch {
            toast.error('Failed to mark disposal as done.');
        }
    };

    const openConfirmDoneModal = (report: PropertyWasteReport) => {
        const items = report.items ?? [];
        if (items.length === 0) {
            toast.error('This waste report has no items to complete.');
            return;
        }

        const missingMethod = items.some((item) => !item.DisposalMethodID);
        if (missingMethod) {
            toast.error('Select disposal methods for all items before marking this report done.');
            return;
        }

        setConfirmDoneTarget({
            reportId: report.PropertyWasteReportID,
            wasteNumber: report.WasteNumber,
            itemCount: items.length,
        });
    };

    const closeConfirmDoneModal = () => {
        if (confirmingDone) return;
        setConfirmDoneTarget(null);
    };

    const confirmMarkReportDone = async () => {
        if (!confirmDoneTarget) return;

        const report = rows.find((row) => row.PropertyWasteReportID === confirmDoneTarget.reportId);
        if (!report) {
            toast.error('Unable to find the selected waste report. Please refresh and try again.');
            setConfirmDoneTarget(null);
            return;
        }

        try {
            setConfirmingDone(true);
            await markReportDone(report);
            setConfirmDoneTarget(null);
        } finally {
            setConfirmingDone(false);
        }
    };

    const saveMethod = async (report: PropertyWasteReport, item: PropertyWasteItem) => {
        if (itemIsDisposed(item)) {
            toast.error('Cannot change method for disposed items.');
            return;
        }

        if (!editingMethodId) {
            toast.error('Please select a disposal method.');
            return;
        }

        try {
            await propertyWasteApi.update(report.PropertyWasteReportID, {
                items: [
                    {
                        property_waste_item_id: item.PropertyWasteItemID,
                        disposal_method_id: Number(editingMethodId),
                        disposal_method_note: editingMethodNote.trim() || null,
                        status: 'method_selected',
                    },
                ],
            });

            toast.success('Disposal method saved.');
            setEditingMethodId('');
            setEditingMethodNote('');
            await load(page);
        } catch {
            toast.error('Failed to save disposal method');
        }
    };

    const openMethodModal = (report: PropertyWasteReport, item: PropertyWasteItem) => {
        if (itemIsDisposed(item)) {
            toast.error('This item is already disposed and cannot change disposal method.');
            return;
        }

        setModalTarget({ reportId: report.PropertyWasteReportID, item });
        setEditingMethodId(item.DisposalMethodID ?? '');
        setEditingMethodNote(item.DisposalMethodNote ?? '');
        setMethodModalOpen(true);
    };

    const closeMethodModal = () => {
        setMethodModalOpen(false);
        setModalTarget(null);
        setEditingMethodId('');
        setEditingMethodNote('');
    };

    const saveMethodFromModal = async () => {
        if (!modalTarget) return;
        const report = rows.find((row) => row.PropertyWasteReportID === modalTarget.reportId);
        if (!report) return;

        await saveMethod(report, modalTarget.item);
        closeMethodModal();
    };

    const methodIcon = (item: PropertyWasteItem) => {
        const iconKey = item.disposalMethod?.IconKey?.toLowerCase().trim();
        const Icon = (iconKey && iconByKey[iconKey]) || iconByKey['trash-2'];
        return <Icon className="w-4 h-4" />;
    };

    const getItemField = (item: PropertyWasteItem, key: 'article' | 'description' | 'propertyNumber' | 'brand' | 'model' | 'serial') => {
        const inventory = item.inventoryDetail;
        const drDetail = inventory?.drDetail;

        if (key === 'article') return drDetail?.article?.ArticleName || '-';
        if (key === 'description') return item.ItemDescription || inventory?.Description || drDetail?.ItemDescription || '-';
        if (key === 'propertyNumber') return item.PropertyNumber || inventory?.PropertyNumber || '-';
        if (key === 'brand') return inventory?.Brand || drDetail?.Brand || '-';
        if (key === 'model') return inventory?.ModelNumber || drDetail?.ModelNumber || '-';
        if (key === 'serial') return inventory?.SerialNumber || drDetail?.SerialNumber || '-';
        return '-';
    };

    const reportDone = (report: PropertyWasteReport) => (report.items ?? []).length > 0 && (report.items ?? []).every((item) => item.Status === 'disposed');

    const itemIsDisposed = (item: PropertyWasteItem) => item.Status === 'disposed';

    const saveReportNotes = async (report: PropertyWasteReport) => {
        const reportId = report.PropertyWasteReportID;
        const notes = reportNotesDraft[reportId] ?? '';

        try {
            setSavingNotesByReportId((prev) => ({ ...prev, [reportId]: true }));
            await propertyWasteApi.update(reportId, { notes });
            toast.success('Disposal notes saved.');
            await load(page);
        } catch {
            toast.error('Failed to save disposal notes.');
        } finally {
            setSavingNotesByReportId((prev) => ({ ...prev, [reportId]: false }));
        }
    };

    return (
        <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: 'fixed' }}>
            <div className="p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
                        <p className="text-slate-500 text-sm">{description}</p>
                    </div>
                    <button
                        onClick={() => load(page)}
                        disabled={isFetching}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                        <p className="text-xs text-slate-500">Total</p>
                        <p className="text-xl font-bold text-slate-900">{reportCounts.total}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                        <p className="text-xs text-slate-500">In Progress</p>
                        <p className="text-xl font-bold text-indigo-700">{reportCounts.inProgress}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                        <p className="text-xs text-slate-500">Done</p>
                        <p className="text-xl font-bold text-emerald-700">{reportCounts.done}</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="grid grid-cols-1 gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by waste #, service #, property #, item"
                                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Waste #</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Source Service #</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Department</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Items</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Workflow</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {isInitialLoading && rows.length === 0 ? (
                                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
                                ) : rows.length === 0 ? (
                                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No property waste records found.</td></tr>
                                ) : (
                                    rows.map((report) => (
                                        <Fragment key={report.PropertyWasteReportID}>
                                            <tr className="hover:bg-slate-50">
                                                <td className="px-4 py-3 text-sm font-semibold text-slate-900">{report.WasteNumber}</td>
                                                <td className="px-4 py-3 text-sm text-slate-700">{report.sourceServiceRecord?.ServiceNumber || '-'}</td>
                                                <td className="px-4 py-3 text-sm text-slate-700">{report.department?.DepartmentCode || report.department?.DepartmentName || '-'}</td>
                                                <td className="px-4 py-3 text-sm text-slate-700">
                                                    <button
                                                        type="button"
                                                        className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900"
                                                        onClick={() => setExpandedReports((prev) => ({ ...prev, [report.PropertyWasteReportID]: !prev[report.PropertyWasteReportID] }))}
                                                    >
                                                        {expandedReports[report.PropertyWasteReportID] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                        {report.items?.length || 0}
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${reportDone(report) ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}`}>
                                                        {reportDone(report) ? 'done' : 'in progress'}
                                                    </span>
                                                </td>
                                            </tr>
                                            {expandedReports[report.PropertyWasteReportID] && (
                                                <tr>
                                                    <td colSpan={5} className="px-4 py-3 bg-slate-50/70">
                                                        <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                                                            {(report.items ?? []).map((item) => (
                                                                <div key={item.PropertyWasteItemID} className="rounded-md border border-slate-100 p-3 text-xs text-slate-700 flex flex-col gap-3">
                                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                                        <div className="font-semibold text-slate-800">{getItemField(item, 'description')}</div>
                                                                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${itemStatusClasses[item.Status]}`}>
                                                                            {statusLabel(item.Status)}
                                                                        </span>
                                                                    </div>

                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-[11px]">
                                                                        <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5"><span className="text-slate-500">Article:</span> <span className="font-medium text-slate-800">{getItemField(item, 'article')}</span></div>
                                                                        <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5"><span className="text-slate-500">Property #:</span> <span className="font-medium text-slate-800">{getItemField(item, 'propertyNumber')}</span></div>
                                                                        <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5"><span className="text-slate-500">Brand:</span> <span className="font-medium text-slate-800">{getItemField(item, 'brand')}</span></div>
                                                                        <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5"><span className="text-slate-500">Model:</span> <span className="font-medium text-slate-800">{getItemField(item, 'model')}</span></div>
                                                                        <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5"><span className="text-slate-500">Serial #:</span> <span className="font-medium text-slate-800">{getItemField(item, 'serial')}</span></div>
                                                                        <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5"><span className="text-slate-500">Condition:</span> <span className="font-medium text-slate-800">{item.condition?.ConditionName || '-'}</span></div>
                                                                    </div>

                                                                    <div className="flex items-center gap-2">
                                                                        {item.disposalMethod ? (
                                                                            <div className="flex flex-col gap-1">
                                                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-slate-700 w-fit">
                                                                                    {methodIcon(item)}
                                                                                    {item.disposalMethod.MethodName}
                                                                                </span>
                                                                                {item.DisposalMethodNote && (
                                                                                    <span className="text-[11px] text-slate-600">Note: {item.DisposalMethodNote}</span>
                                                                                )}
                                                                            </div>
                                                                        ) : (
                                                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-rose-100 text-rose-700">
                                                                                <Ban className="w-4 h-4" />
                                                                                No disposal method selected
                                                                            </span>
                                                                        )}

                                                                        {canManage && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => openMethodModal(report, item)}
                                                                                disabled={itemIsDisposed(item)}
                                                                                className={`px-2 py-1 text-xs rounded-md border border-slate-300 transition ${itemIsDisposed(item) ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'hover:bg-slate-100'}`}
                                                                            >
                                                                                {itemIsDisposed(item) ? 'Disposal done' : item.disposalMethod ? 'Change method' : 'Set method'}
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}

                                                            <div className="rounded-md border border-slate-100 p-3 space-y-2">
                                                                <label className="text-xs font-medium text-slate-700">Disposal notes</label>
                                                                <textarea
                                                                    value={reportNotesDraft[report.PropertyWasteReportID] ?? ''}
                                                                    onChange={(event) => {
                                                                        const value = event.target.value;
                                                                        setReportNotesDraft((prev) => ({ ...prev, [report.PropertyWasteReportID]: value }));
                                                                    }}
                                                                    rows={3}
                                                                    placeholder="Add overall notes for this disposal report..."
                                                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                                                                />
                                                                {canManage && (
                                                                    <div className="flex justify-end">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => saveReportNotes(report)}
                                                                            disabled={!!savingNotesByReportId[report.PropertyWasteReportID]}
                                                                            className="px-3 py-1.5 text-xs rounded-md border border-slate-300 hover:bg-slate-100 disabled:opacity-50"
                                                                        >
                                                                            {savingNotesByReportId[report.PropertyWasteReportID] ? 'Saving...' : 'Save notes'}
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {canManage && (
                                                                <div className="pt-2 border-t border-slate-200 flex justify-end">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openConfirmDoneModal(report)}
                                                                        disabled={reportDone(report)}
                                                                        className="inline-flex items-center gap-2 px-3 py-2 text-xs rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                                                                    >
                                                                        <CheckCircle2 className="w-4 h-4" />
                                                                        {reportDone(report) ? 'Disposal done' : 'Mark disposal done'}
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {lastPage > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200">
                            <button
                                onClick={() => page > 1 && load(page - 1)}
                                disabled={page <= 1 || isFetching}
                                className="px-3 py-1 text-sm rounded border border-slate-300 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <span className="text-sm text-slate-600">Page {page} of {lastPage}</span>
                            <button
                                onClick={() => page < lastPage && load(page + 1)}
                                disabled={page >= lastPage || isFetching}
                                className="px-3 py-1 text-sm rounded border border-slate-300 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {methodModalOpen && modalTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={closeMethodModal} />
                    <div className="relative w-full max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
                        <h2 className="text-lg font-semibold text-slate-900">Select Disposal Method</h2>
                        <p className="mt-1 text-sm text-slate-600">
                            Item: <span className="font-medium">{modalTarget.item.ItemDescription || modalTarget.item.PropertyNumber || '-'}</span>
                        </p>

                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[40vh] overflow-auto pr-1">
                            {disposalMethods.map((method) => {
                                const iconKey = method.IconKey?.toLowerCase().trim();
                                const Icon = (iconKey && iconByKey[iconKey]) || iconByKey['trash-2'];
                                const selected = editingMethodId === method.DisposalMethodID;

                                return (
                                    <button
                                        key={method.DisposalMethodID}
                                        type="button"
                                        onClick={() => setEditingMethodId(method.DisposalMethodID)}
                                        className={`text-left rounded-lg border p-3 transition ${selected ? 'border-[var(--primary)] bg-[var(--primary)]/10' : 'border-slate-200 hover:bg-slate-50'}`}
                                    >
                                        <div className="flex items-center gap-2 text-slate-800">
                                            <Icon className="w-4 h-4" />
                                            <span className="font-medium">{method.MethodName}</span>
                                        </div>
                                        {method.Description && (
                                            <p className="mt-1 text-xs text-slate-500">{method.Description}</p>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-4 space-y-1">
                            <label className="text-xs font-medium text-slate-700">Disposal method note (optional)</label>
                            <textarea
                                value={editingMethodNote}
                                onChange={(event) => setEditingMethodNote(event.target.value)}
                                rows={3}
                                placeholder="Add note for this item's disposal method..."
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                            />
                        </div>

                        <div className="mt-5 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={closeMethodModal}
                                className="px-3 py-2 text-sm rounded-md border border-slate-300 hover:bg-slate-100"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={saveMethodFromModal}
                                disabled={!editingMethodId}
                                className="px-3 py-2 text-sm rounded-md bg-[var(--primary)] text-white disabled:opacity-50"
                            >
                                Save method
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {confirmDoneTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={closeConfirmDoneModal} />
                    <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
                        <h2 className="text-lg font-semibold text-slate-900">Confirm Disposal Completion</h2>
                        <p className="mt-2 text-sm text-slate-600">
                            You are about to mark <span className="font-semibold">{confirmDoneTarget.wasteNumber}</span> as done.
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                            This will set <span className="font-semibold">{confirmDoneTarget.itemCount}</span> item(s) to disposed.
                        </p>

                        <div className="mt-5 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={closeConfirmDoneModal}
                                disabled={confirmingDone}
                                className="px-3 py-2 text-sm rounded-md border border-slate-300 hover:bg-slate-100 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmMarkReportDone}
                                disabled={confirmingDone}
                                className="px-3 py-2 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {confirmingDone ? 'Completing...' : 'Yes, mark done'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

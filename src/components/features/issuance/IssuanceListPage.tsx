'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle, ChevronDown, ChevronUp, Clock, FileText, RefreshCw, Search } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { toast } from 'sonner';

import issuanceAPI from '@/lib/api/issuance';

interface DeliveryReceiptForIssuance {
    DRID: number;
    DRNumber: string;
    RequestedBy?: string | null;
    DepartmentID?: number | null;
    DepartmentName?: string | null;
    DateReceived?: string | null;
    InspectionStatus?: 'pending' | 'inspected' | null;
    IARID?: number | null;
    IARNumber?: string | null;
    IARDateAccepted?: string | null;
    IARAcceptedBy?: number | null;
    IsAccepted?: number | boolean | null;
    AvailableItems?: number;
    items_by_document_type?: {
        PAR?: IarIssuedItem[];
        ICS?: IarIssuedItem[];
    };
    issuances_by_document_type?: {
        PAR?: IssuanceSummary | null;
        ICS?: IssuanceSummary | null;
    };
}

interface IarIssuedItem {
    IARDetailID: number;
    ItemDescription?: string | null;
    Brand?: string | null;
    ModelNumber?: string | null;
    SerialNumber?: string | null;
    QuantityAccepted?: number | null;
    DocumentType?: 'PAR' | 'ICS' | string | null;
}

interface IssuanceSummary {
    IssuanceID: number;
    DocumentType?: 'PAR' | 'ICS' | string | null;
    DocumentNumber?: string | null;
    Status?: string | null;
}

interface IssuanceListPageProps {
    baseRoute: string;
    isAdmin?: boolean;
    pageTitle?: string;
    pageDescription?: string;
}

function safeDate(dateValue: string | null | undefined): Date | null {
    if (!dateValue) return null;
    const parsed = new Date(dateValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function IssuanceListPage({
    baseRoute,
    pageTitle,
    pageDescription,
}: IssuanceListPageProps) {
    const [rows, setRows] = useState<DeliveryReceiptForIssuance[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [acknowledgingId, setAcknowledgingId] = useState<number | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [pendingRow, setPendingRow] = useState<DeliveryReceiptForIssuance | null>(null);
    const [docTypeByDr, setDocTypeByDr] = useState<Record<number, 'PAR' | 'ICS'>>({});
    const [expandedByDr, setExpandedByDr] = useState<Record<number, boolean>>({});

    const loadRows = useCallback(async (page = 1) => {
        try {
            setLoading(true);
            const response = await issuanceAPI.getDeliveryReceiptsForIssuance({
                page,
                per_page: 15,
                search: searchTerm || undefined,
            });

            const data = response.data || [];
            data.sort((a, b) => {
                const aDate = safeDate(a.DateReceived)?.getTime() ?? 0;
                const bDate = safeDate(b.DateReceived)?.getTime() ?? 0;
                return bDate - aDate;
            });

            setRows(data);
            setCurrentPage(response.current_page);
            setTotalPages(response.last_page);
        } catch {
            toast.error('Failed to load delivery receipts for issuance');
        } finally {
            setLoading(false);
        }
    }, [searchTerm]);

    useEffect(() => {
        loadRows(1);
    }, [loadRows]);

    const handleRefresh = () => {
        loadRows(currentPage);
    };

    const handlePageChange = (page: number) => {
        if (page < 1 || page > totalPages) return;
        loadRows(page);
    };

    const filteredRows = useMemo(() => {
        if (!searchTerm) return rows;
        const searchLower = searchTerm.toLowerCase();
        return rows.filter((row) => (
            row.DRNumber?.toLowerCase().includes(searchLower) ||
            (row.RequestedBy || '').toLowerCase().includes(searchLower) ||
            (row.DepartmentName || '').toLowerCase().includes(searchLower) ||
            (row.IARNumber || '').toLowerCase().includes(searchLower)
        ));
    }, [rows, searchTerm]);

    const handleAcknowledge = async (row: DeliveryReceiptForIssuance) => {
        if (acknowledgingId) return;

        try {
            setAcknowledgingId(row.DRID);
            await issuanceAPI.acknowledgeInspection({ dr_id: row.DRID });
            toast.success('IAR acknowledged and inventory updated');
            await loadRows(currentPage);
        } catch (error: unknown) {
            const maybeAxios = error as { response?: { data?: { message?: string } } };
            const message = maybeAxios?.response?.data?.message;
            toast.error(message || 'Failed to acknowledge IAR');
        } finally {
            setAcknowledgingId(null);
        }
    };

    const openConfirm = (row: DeliveryReceiptForIssuance) => {
        setPendingRow(row);
        setConfirmOpen(true);
    };

    const confirmAcknowledge = async () => {
        if (!pendingRow) return;
        await handleAcknowledge(pendingRow);
        setConfirmOpen(false);
        setPendingRow(null);
    };

    const handlePrint = (row: DeliveryReceiptForIssuance, docType: 'PAR' | 'ICS') => {
        const existing = row.issuances_by_document_type?.[docType];
        if (existing?.IssuanceID) {
            const printUrl = `${baseRoute}/${existing.IssuanceID}/print`;
            window.open(printUrl, '_blank', 'noopener,noreferrer');
            return;
        }

        issuanceAPI.ensureIssuances({ dr_id: row.DRID, iar_id: row.IARID || undefined })
            .then((response) => {
                const ensured = response.data?.issuances_by_document_type?.[docType];
                if (!ensured?.IssuanceID) {
                    toast.error('Issuance document is not available yet');
                    return;
                }

                setRows((prev) => prev.map((item) => (
                    item.DRID === row.DRID
                        ? {
                            ...item,
                            issuances_by_document_type: response.data?.issuances_by_document_type,
                        }
                        : item
                )));

                const printUrl = `${baseRoute}/${ensured.IssuanceID}/print`;
                window.open(printUrl, '_blank', 'noopener,noreferrer');
            })
            .catch(() => {
                toast.error('Failed to prepare issuance document');
            });
    };

    return (
        <div className="min-h-screen bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')" }}>
            <div className="p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">
                            {pageTitle || 'Property Issuance'}
                        </h1>
                        <p className="text-slate-500 text-sm">
                            {pageDescription || 'Delivery receipts inspected and ready for issuance'}
                        </p>
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={loading}
                        className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search DR number, requester, department, or IAR number..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                        />
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    {filteredRows.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">
                            <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                            <h3 className="text-lg font-medium text-slate-400 mb-1">No DRs Ready for Issuance</h3>
                            <p className="text-sm text-slate-400">
                                {searchTerm ? 'Try adjusting your search terms' : 'No inspected delivery receipts found'}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-200">
                            {filteredRows.map((row) => {
                                const isAccepted = !!row.IsAccepted;
                                const itemsByType = row.items_by_document_type ?? {};
                                const availableTypes = (['PAR', 'ICS'] as const).filter(
                                    (type) => (itemsByType[type]?.length ?? 0) > 0
                                );
                                const selectedType = docTypeByDr[row.DRID]
                                    ?? availableTypes[0]
                                    ?? 'PAR';
                                const currentItems = itemsByType[selectedType] ?? [];
                                const isExpanded = expandedByDr[row.DRID] ?? false;
                                const issuanceByType = row.issuances_by_document_type ?? {};
                                const canPrint = row.InspectionStatus === 'inspected' && availableTypes.length > 0;

                                return (
                                    <div key={row.DRID} className="p-4 hover:bg-slate-50 transition-colors">
                                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 bg-[var(--primary)]/10 rounded-lg flex items-center justify-center">
                                                    <FileText className="w-5 h-5 text-[var(--primary)]" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-semibold text-slate-900">{row.DRNumber}</h3>
                                                        {row.IARNumber && (
                                                            <span className="text-xs text-slate-500">IAR: {row.IARNumber}</span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                                                        <span>{row.RequestedBy || 'Requester N/A'}</span>
                                                        <span>{row.DepartmentName || 'Department N/A'}</span>
                                                        <span>
                                                            {row.DateReceived
                                                                ? format(toZonedTime(new Date(row.DateReceived), 'Asia/Manila'), 'MMM dd, yyyy')
                                                                : 'Date N/A'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${isAccepted ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-800'}`}>
                                                    {isAccepted ? (
                                                        <>
                                                            <CheckCircle className="w-3.5 h-3.5" />
                                                            Accepted
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Clock className="w-3.5 h-3.5" />
                                                            Inspected
                                                        </>
                                                    )}
                                                </span>
                                                {availableTypes.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handlePrint(row, selectedType)}
                                                        disabled={!canPrint}
                                                        className="inline-flex items-center gap-2 px-3 py-2 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                                                    >
                                                        <FileText className="w-4 h-4" />
                                                        Print {selectedType}
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => openConfirm(row)}
                                                    disabled={!!row.IsAccepted || acknowledgingId === row.DRID}
                                                    className="inline-flex items-center gap-2 px-3 py-2 bg-[var(--primary)] text-white text-sm rounded-lg hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
                                                >
                                                    {acknowledgingId === row.DRID ? 'Processing...' : 'Acknowledge'}
                                                </button>
                                            </div>
                                        </div>
                                        {availableTypes.length > 0 && (
                                            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/60">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setExpandedByDr((prev) => ({
                                                            ...prev,
                                                            [row.DRID]: !isExpanded,
                                                        }));
                                                    }}
                                                    className="w-full px-3 py-2 flex items-center justify-between text-xs font-medium text-slate-600"
                                                >
                                                    <span>Items by document type</span>
                                                    {isExpanded ? (
                                                        <ChevronUp className="w-4 h-4" />
                                                    ) : (
                                                        <ChevronDown className="w-4 h-4" />
                                                    )}
                                                </button>
                                                {isExpanded && (
                                                    <div className="px-3 pb-3">
                                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                                            {availableTypes.length > 1 ? (
                                                                <select
                                                                    value={selectedType}
                                                                    onChange={(event) => {
                                                                        const value = event.target.value as 'PAR' | 'ICS';
                                                                        setDocTypeByDr((prev) => ({
                                                                            ...prev,
                                                                            [row.DRID]: value,
                                                                        }));
                                                                    }}
                                                                    className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white"
                                                                >
                                                                    {availableTypes.map((type) => (
                                                                        <option key={type} value={type}>{type}</option>
                                                                    ))}
                                                                </select>
                                                            ) : (
                                                                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                                                                    {availableTypes[0]}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="space-y-2">
                                                            {currentItems.map((item) => (
                                                                <div
                                                                    key={item.IARDetailID}
                                                                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-slate-700"
                                                                >
                                                                    <div>
                                                                        <div className="font-medium">
                                                                            {item.ItemDescription || 'Item'}
                                                                        </div>
                                                                        <div className="text-xs text-slate-500">
                                                                            {[item.Brand, item.ModelNumber, item.SerialNumber]
                                                                                .filter(Boolean)
                                                                                .join(' · ') || 'No brand/model/serial'}
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-xs text-slate-500">
                                                                        Qty accepted: {item.QuantityAccepted ?? 0}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {totalPages > 1 && (
                        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <span className="text-sm text-slate-600">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <Dialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 bg-black/40" />
                    <Dialog.Content className="fixed left-1/2 top-1/2 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
                        <Dialog.Title className="text-lg font-semibold text-slate-900">Confirm Acknowledgment</Dialog.Title>
                        <Dialog.Description className="mt-2 text-sm text-slate-600">
                            Are you sure you want to acknowledge this IAR? Make sure the item is signed on paper by the department head or end user.
                        </Dialog.Description>
                        {pendingRow && (
                            <div className="mt-3 text-sm text-slate-700">
                                <div>DR: {pendingRow.DRNumber}</div>
                                {pendingRow.IARNumber && <div>IAR: {pendingRow.IARNumber}</div>}
                            </div>
                        )}
                        <div className="mt-6 flex items-center justify-end gap-2">
                            <Dialog.Close asChild>
                                <button
                                    type="button"
                                    className="px-4 py-2 text-sm border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                            </Dialog.Close>
                            <button
                                type="button"
                                onClick={confirmAcknowledge}
                                className="px-4 py-2 text-sm bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)]"
                            >
                                Yes, Acknowledge
                            </button>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </div>
    );
}

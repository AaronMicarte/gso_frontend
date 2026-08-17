'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle, ChevronDown, ChevronUp, Clock, Eye, FileText, RefreshCw, Search } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { toast } from 'sonner';

import issuanceAPI from '@/lib/api/issuance';
import { CardListSkeleton } from '@/components/ui/ListSkeletons';
import AssignReceiversModal from './AssignReceiversModal';

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
    IsPartial?: boolean | number | null;
    is_partial?: boolean;
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
    IARDetailID?: number;
    DRDetailID?: number;
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

type DeliveryReceiptTimeSource = Partial<{
    created_at: string | null;
    CreatedDate: string | null;
    createdAt: string | null;
    DateReceived: string | null;
}> | null | undefined;

function createdTimeForDr(dr: DeliveryReceiptTimeSource): number {
    if (!dr) return 0;
    const candidates = [
        dr.created_at,
        dr.CreatedDate,
        dr.createdAt,
        dr.DateReceived,
    ];

    for (const v of candidates) {
        if (!v) continue;
        const t = new Date(String(v)).getTime();
        if (!Number.isNaN(t)) return t;
    }

    return 0;
}

function getAvailableDocumentTypes(row: DeliveryReceiptForIssuance): Array<'PAR' | 'ICS'> {
    const itemsByType = row.items_by_document_type ?? {};
    const issuanceByType = row.issuances_by_document_type ?? {};

    return (['PAR', 'ICS'] as const).filter(
        (type) => (itemsByType[type]?.length ?? 0) > 0 || !!issuanceByType[type]
    );
}

function getSelectedDocumentType(row: DeliveryReceiptForIssuance, docTypeByDr: Record<number, 'PAR' | 'ICS'>): 'PAR' | 'ICS' {
    const availableTypes = getAvailableDocumentTypes(row);
    return docTypeByDr[row.DRID] ?? availableTypes[0] ?? 'PAR';
}

export function IssuanceListPage({
    baseRoute,
    pageTitle,
    pageDescription,
}: IssuanceListPageProps) {
    const router = useRouter();
    const [rows, setRows] = useState<DeliveryReceiptForIssuance[]>([]);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isFetching, setIsFetching] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [acknowledgingId, setAcknowledgingId] = useState<number | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [pendingRow, setPendingRow] = useState<DeliveryReceiptForIssuance | null>(null);
    // RIS number input removed per request; backend will auto-generate if omitted
    const [docTypeByDr, setDocTypeByDr] = useState<Record<number, 'PAR' | 'ICS'>>({});
    const [expandedByDr, setExpandedByDr] = useState<Record<number, boolean>>({});

    const loadRows = useCallback(async (page = 1) => {
        try {
            setIsFetching(true);
            const response = await issuanceAPI.getDeliveryReceiptsForIssuance({
                page,
                per_page: 15,
                search: searchTerm || undefined,
            });

            const data = response.data || [];
            // Prefer created timestamp if available, otherwise fallback to DateReceived
            data.sort((a, b) => {
                const aTime = createdTimeForDr(a);
                const bTime = createdTimeForDr(b);
                return bTime - aTime;
            });

            setRows(data);
            setCurrentPage(response.current_page);
            setTotalPages(response.last_page);
        } catch {
            toast.error('Failed to load delivery receipts for issuance');
        } finally {
            setIsFetching(false);
            setIsInitialLoading(false);
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

    const handleAcknowledge = async (row: DeliveryReceiptForIssuance, risNumber?: string) => {
        if (acknowledgingId) return;

        try {
            setAcknowledgingId(row.DRID);
            const payload: Record<string, unknown> = { dr_id: row.DRID };
            if (risNumber) payload.ris_number = risNumber;
            const response = await issuanceAPI.acknowledgeInspection(payload);
            const createdRisNumber = (response as { data?: { ris_number?: string } }).data?.ris_number;
            toast.success(
                createdRisNumber
                    ? `IAR acknowledged and RIS ${createdRisNumber} created`
                    : 'IAR acknowledged and inventory updated'
            );
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
        // Call acknowledge without RIS number — backend will auto-generate if needed.
        await handleAcknowledge(pendingRow);
        setConfirmOpen(false);
        setPendingRow(null);
    };

    const handlePrint = (row: DeliveryReceiptForIssuance) => {
        const selectedType = getSelectedDocumentType(row, docTypeByDr);

        issuanceAPI.ensureIssuances({ dr_id: row.DRID, iar_id: row.IARID || undefined })
            .then((response) => {
                const ensured = response.data?.issuances_by_document_type?.[selectedType];
                if (!ensured?.IssuanceID) {
                    toast.error(`No ${selectedType} issuance document is available yet`);
                    return;
                }

                const refreshedRow: DeliveryReceiptForIssuance = {
                    ...row,
                    issuances_by_document_type: response.data?.issuances_by_document_type ?? row.issuances_by_document_type,
                    items_by_document_type: response.data?.items_by_document_type ?? row.items_by_document_type,
                };

                setRows((prev) => {
                    const updated = prev.map((item) => (
                        item.DRID === row.DRID ? refreshedRow : item
                    ));

                    updated.sort((a, b) => {
                        const aDate = safeDate(a.DateReceived)?.getTime() ?? 0;
                        const bDate = safeDate(b.DateReceived)?.getTime() ?? 0;
                        return bDate - aDate;
                    });

                    return updated;
                });

                openAssignModalForIssuance(ensured.IssuanceID, refreshedRow, selectedType);
            })
            .catch(() => {
                toast.error('Failed to prepare issuance document');
            });
    };

    // Assign receivers modal state
    const [assignOpen, setAssignOpen] = useState(false);
    const [assignIssuanceId, setAssignIssuanceId] = useState<number | null>(null);
    const [assignDocumentType, setAssignDocumentType] = useState<'PAR' | 'ICS' | null>(null);
    const [assignItems, setAssignItems] = useState<Array<{
        IssuanceDetailID: number;
        ItemDescription?: string | null;
        QuantityIssued?: number | null;
        Article?: string | null;
        Brand?: string | null;
        ModelNumber?: string | null;
        SerialNumber?: string | null;
    }>>([]);

    const openAssignModalForIssuance = async (
        issuanceId: number,
        row: DeliveryReceiptForIssuance,
        documentType: 'PAR' | 'ICS',
    ) => {
        try {
            const issuance = await issuanceAPI.getById(issuanceId);
            const mappedItems = issuance.details?.map((d: {
                IssuanceDetailID?: number;
                InventoryDetailID?: number;
                ItemDescription?: string | null;
                QuantityIssued?: number | null;
                Quantity?: number | null;
                inventoryDetail?: {
                    propertyInventory?: {
                        ItemDescription?: string | null;
                        ItemName?: string | null;
                        Brand?: string | null;
                        ModelNumber?: string | null;
                        SerialNumber?: string | null;
                    };
                    Description?: string | null;
                    ItemName?: string | null;
                    Brand?: string | null;
                    ModelNumber?: string | null;
                    SerialNumber?: string | null;
                    drDetail?: {
                        article?: {
                            ArticleName?: string | null;
                        };
                        ItemDescription?: string | null;
                        Brand?: string | null;
                        ModelNumber?: string | null;
                        SerialNumber?: string | null;
                    };
                };
            }) => ({
                IssuanceDetailID: d.IssuanceDetailID ?? d.InventoryDetailID ?? 0,
                ItemDescription: d.ItemDescription
                    ?? d.inventoryDetail?.propertyInventory?.ItemDescription
                    ?? d.inventoryDetail?.Description
                    ?? d.inventoryDetail?.ItemName,
                QuantityIssued: d.QuantityIssued ?? d.Quantity ?? 1,
                Article: d.inventoryDetail?.drDetail?.article?.ArticleName
                    ?? d.inventoryDetail?.propertyInventory?.ItemName
                    ?? d.inventoryDetail?.drDetail?.ItemDescription
                    ?? null,
                Brand: d.inventoryDetail?.drDetail?.Brand
                    ?? d.inventoryDetail?.propertyInventory?.Brand
                    ?? null,
                ModelNumber: d.inventoryDetail?.drDetail?.ModelNumber
                    ?? d.inventoryDetail?.propertyInventory?.ModelNumber
                    ?? null,
                SerialNumber: d.inventoryDetail?.drDetail?.SerialNumber
                    ?? d.inventoryDetail?.propertyInventory?.SerialNumber
                    ?? null,
            })) || [];

            // Issuance records are already scoped by document type (PAR/ICS).
            // Use all synced issuance details so newly added partial-DR items appear immediately.
            const items = mappedItems.filter((item) => item.IssuanceDetailID > 0);

            if (items.length === 0) {
                toast.error(`No ${documentType}-eligible items are available for assignment`);
                return;
            }

            setAssignItems(items);
            setAssignIssuanceId(issuanceId);
            setAssignDocumentType(documentType);
            setAssignOpen(true);
        } catch {
            toast.error('Failed to load issuance for assignment');
        }
    };

    return (
        <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}>
            <div className="p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">
                            {pageTitle || 'Property Issuance'}
                        </h1>
                        <p className="text-slate-500 text-sm">
                            {pageDescription || 'Delivery receipts pending or inspected and ready for issuance'}
                        </p>
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={isFetching}
                        className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
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
                    {isInitialLoading && rows.length === 0 ? (
                        <CardListSkeleton cards={4} />
                    ) : filteredRows.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">
                            <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                            <h3 className="text-lg font-medium text-slate-400 mb-1">No delivery receipts available</h3>
                            <p className="text-sm text-slate-400">
                                {searchTerm ? 'Try adjusting your search terms' : 'No delivery receipts found'}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-200">
                            {filteredRows.map((row) => {
                                const isAccepted = !!row.IsAccepted;
                                const issuanceByType = row.issuances_by_document_type ?? {};
                                const hasAcknowledgedIssuance = Object.values(issuanceByType).some(
                                    (issuance) => issuance?.Status === 'acknowledged'
                                );
                                const availableTypes = getAvailableDocumentTypes(row);
                                const selectedType = getSelectedDocumentType(row, docTypeByDr);
                                const currentItems = (row.items_by_document_type ?? {})[selectedType] ?? [];
                                const isExpanded = expandedByDr[row.DRID] ?? false;

                                const isPartial = !!(row.is_partial ?? row.IsPartial);
                                const canPrint = (row.InspectionStatus === 'inspected' || hasAcknowledgedIssuance) && availableTypes.length > 0;

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
                                                {(() => {
                                                    let label = 'Inspected';
                                                    let badgeClass = 'bg-yellow-100 text-yellow-800';
                                                    let Icon = Clock;

                                                    if (hasAcknowledgedIssuance) {
                                                        label = isPartial ? 'Partial / Issued' : 'Acknowledged';
                                                        badgeClass = isPartial ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-700';
                                                        Icon = CheckCircle;
                                                    } else if (isAccepted) {
                                                        label = isPartial ? 'Partial / Issued' : 'Accepted';
                                                        badgeClass = isPartial ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700';
                                                        Icon = CheckCircle;
                                                    } else if (row.InspectionStatus === 'pending') {
                                                        label = 'Editing';
                                                        badgeClass = 'bg-yellow-100 text-yellow-800';
                                                        Icon = Clock;
                                                    } else if (isPartial) {
                                                        label = 'Partial / For Issuance';
                                                        badgeClass = 'bg-amber-100 text-amber-800';
                                                        Icon = Clock;
                                                    }

                                                    return (
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${badgeClass}`}>
                                                            <Icon className="w-3.5 h-3.5" />
                                                            {label}
                                                        </span>
                                                    );
                                                })()}
                                                {availableTypes.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handlePrint(row)}
                                                        disabled={!canPrint}
                                                        className="inline-flex items-center gap-2 px-3 py-2 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                                                    >
                                                        <FileText className="w-4 h-4" />
                                                        Print {selectedType}
                                                    </button>
                                                )}
                                                {(() => {
                                                    const viewIssuanceId = issuanceByType[selectedType]?.IssuanceID
                                                        ?? Object.values(issuanceByType).find(
                                                            (issuance): issuance is IssuanceSummary => Boolean(issuance?.IssuanceID)
                                                        )?.IssuanceID;
                                                    if (!viewIssuanceId) return null;

                                                    return (
                                                        <button
                                                            type="button"
                                                            onClick={() => router.push(`${baseRoute}/${viewIssuanceId}`)}
                                                            className="inline-flex items-center gap-2 px-3 py-2 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50 transition-colors"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                            View
                                                        </button>
                                                    );
                                                })()}
                                                <button
                                                    type="button"
                                                    onClick={() => openConfirm(row)}
                                                    disabled={
                                                        hasAcknowledgedIssuance ||
                                                        !!row.IsAccepted ||
                                                        acknowledgingId === row.DRID ||
                                                        row.InspectionStatus !== 'inspected'
                                                    }
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
                                                            {currentItems.map((item, index) => (
                                                                <div
                                                                    key={item.DRDetailID ?? item.IARDetailID ?? `${row.DRID}-${selectedType}-${index}`}
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
                        </div >
                    )}

                    {
                        totalPages > 1 && (
                            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
                                <button
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1 || isFetching}
                                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                <span className="text-sm text-slate-600">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages || isFetching}
                                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        )
                    }
                </div >
            </div >

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
                        {/* RIS number input removed — backend will auto-generate if needed */}
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

            <AssignReceiversModal
                open={assignOpen}
                onOpenChange={setAssignOpen}
                issuanceId={assignIssuanceId}
                documentType={assignDocumentType ?? undefined}
                items={assignItems}
                onSaved={(result) => {
                    // Close modal and refresh list; printing handled by onPreparePrintTabs
                    setAssignOpen(false);
                    loadRows(currentPage);
                }}
                onPreparePrintTabs={(assignments, id) => {
                    const grouped = new Map<string, { receiverName: string; receiverOffice: string }>();
                    assignments.forEach((assignment) => {
                        const receiverName = assignment.receiver_name.trim() || 'Receiving Custodian';
                        const receiverOffice = assignment.position_office?.trim() || '';
                        const key = `${receiverName}||${receiverOffice}`;
                        if (!grouped.has(key)) grouped.set(key, { receiverName, receiverOffice });
                    });

                    const groups = Array.from(grouped.values());
                    const baseUrl = `${window.location.origin}${baseRoute}/${id}/print`;

                    // Build common query params from issuance modal context (document type and details)
                    const docType = assignDocumentType;
                    const detailIdsParam = (() => {
                        // Try to extract detail ids from assignments grouping if they exist
                        const allDetailIds: number[] = [];
                        (assignments || []).forEach((a) => {
                            // Assignments don't include detail ids here; AssignReceiversSaveResult.assignments is available on onSaved
                        });
                        return undefined;
                    })();

                    const baseWithType = docType ? `${baseUrl}?type=${encodeURIComponent(docType)}` : baseUrl;

                    if (groups.length === 1) {
                        const value = encodeURIComponent(JSON.stringify([groups[0].receiverName, groups[0].receiverOffice]));
                        const url = baseWithType.includes('?') ? `${baseWithType}&receiver_key=${value}` : `${baseWithType}?receiver_key=${value}`;
                        const win = window.open('about:blank', '_blank');
                        return { windows: [win], urls: [url] };
                    }

                    const win = window.open('about:blank', '_blank');
                    return { windows: [win], urls: [baseWithType] };
                }}
            />
        </div >
    );
}

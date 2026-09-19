'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, Building2, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { DepartmentCrossCheckResponse } from '@/types/rpcInventory';
import { exportDepartmentCrossCheckToExcel } from './RpcDepartmentCrossCheckExport';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    data: DepartmentCrossCheckResponse | null;
    selectedType: string;
    loading?: boolean;
}

const fmt = (val: number) =>
    (val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function RpcDepartmentCrossCheckModal({
    isOpen,
    onClose,
    data,
    selectedType,
    loading = false,
}: Props) {
    const [isExporting, setIsExporting] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [isOpen]);

    if (!isOpen || !mounted) return null;

    const handlePrint = () => window.print();

    const handleExportExcel = async () => {
        if (!data) return;
        try {
            setIsExporting(true);
            await exportDepartmentCrossCheckToExcel(data, selectedType);
        } finally {
            setIsExporting(false);
        }
    };

    const items = data?.data || [];
    const department = data?.department as
        | (NonNullable<DepartmentCrossCheckResponse['department']> & {
            DepartmentHead?: string;
        })
        | undefined;
    const summary = data?.summary;

    const content = (
        <>
            <style jsx global>{`
                @media print {
                    html, body {
                        height: auto !important;
                        overflow: visible !important;
                        background: #fff !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    body > * {
                        display: none !important;
                    }
                    body > #cross-check-portal-root {
                        display: block !important;
                    }

                    #cross-check-portal-root,
                    #cross-check-portal-root * {
                        overflow: visible !important;
                        max-height: none !important;
                        position: static !important;
                        box-shadow: none !important;
                        backdrop-filter: none !important;
                        transform: none !important;
                        background: transparent !important;
                    }
                    #cross-check-portal-root {
                        display: block !important;
                        background: #fff !important;
                    }

                    #cross-check-print-area {
                        display: block !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #fff !important;
                        color: #000 !important;
                        border: none !important;
                        border-radius: 0 !important;
                    }

                    /* ── KEY: force fixed layout so browser stops wrapping ── */
                    #cross-check-print-area table {
                        table-layout: fixed !important;
                        width: 100% !important;
                    }
                    #cross-check-print-area td,
                    #cross-check-print-area th {
                        overflow: hidden !important;
                        text-overflow: ellipsis !important;
                        white-space: nowrap !important;
                        font-size: 8px !important;
                        padding: 2px 3px !important;
                        line-height: 1.15 !important;
                    }

                    .print-hide {
                        display: none !important;
                    }

                    /* ── Landscape override — works now that the global
                       @page { size: auto; margin: 10mm; } block has been
                       removed from globals.css ── */
                    @page {
                        size: landscape;
                        margin: 8mm;
                    }
                    thead {
                        display: table-header-group;
                    }
                    tr {
                        page-break-inside: avoid;
                    }
                    .print-total-row {
                        page-break-inside: avoid;
                    }
                }
            `}</style>

            <div id="cross-check-portal-root" className="cross-check-modal-shell fixed inset-0 z-50">
                <div
                    className="absolute inset-0 bg-black/60 backdrop-blur-xs print:hidden"
                    onClick={onClose}
                />

                <div className="absolute inset-0 flex items-start justify-center overflow-y-auto p-4 sm:p-6 print:p-0 print:static print:overflow-visible print:block">
                    <div className="relative w-full max-w-7xl my-4 flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden print:m-0 print:border-none print:shadow-none print:rounded-none print:max-w-none print:overflow-visible print:static print:block">
                        {/* Actions Bar */}
                        <div className="print-hide flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200 bg-slate-50/80 shrink-0">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="p-2 bg-slate-100 rounded-xl shrink-0">
                                    <Building2 className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-base font-bold truncate">
                                        Department Cross-Checking Preview
                                    </h2>
                                    <p className="text-xs text-slate-500 truncate">
                                        {department
                                            ? `${department.DepartmentName} (${department.DepartmentCode || 'N/A'})`
                                            : 'Select department'}{' '}
                                        • Print-style view for cross-checking
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleExportExcel}
                                    disabled={loading || !items.length || isExporting}
                                    className="inline-flex items-center gap-2 whitespace-nowrap"
                                >
                                    <FileSpreadsheet className="w-4 h-4" />
                                    <span>{isExporting ? 'Exporting...' : 'Export Excel'}</span>
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handlePrint}
                                    disabled={loading || !items.length}
                                    className="inline-flex items-center gap-2 whitespace-nowrap"
                                >
                                    <Printer className="w-4 h-4" />
                                    <span>Print Preview</span>
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={onClose}
                                    className="px-2"
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Printable Content */}
                        <div
                            className="flex-1 overflow-y-auto p-6 md:p-8 bg-white print:p-0 print:overflow-visible print:flex-none print:block"
                            id="cross-check-print-area"
                        >
                            {loading ? (
                                <div className="py-20 text-center text-slate-500">
                                    Loading cross-checking assets...
                                </div>
                            ) : !items.length ? (
                                <div className="py-20 text-center text-slate-500">
                                    No assets found for the selected department.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Header — matches Excel export */}
                                    <div className="pb-3 border-b-2 border-black text-center">
                                        <h1 className="text-xl font-bold uppercase tracking-wide">
                                            Property Acknowledgement Receipt
                                        </h1>
                                        <div className="text-sm mt-1">
                                            {department?.DepartmentHead &&
                                                String(department.DepartmentHead).trim() !== ''
                                                ? `${String(department.DepartmentHead).toUpperCase()} / ${department?.DepartmentName ?? ''
                                                }`
                                                : `${department?.DepartmentName ?? ''}`}
                                        </div>
                                    </div>

                                    {/* Table — all 13 columns, matching Excel export */}
                                    <div className="overflow-hidden">
                                        <table className="w-full border-collapse text-[11px] print:text-[8px]">
                                            <colgroup>
                                                <col style={{ width: '9%' }} />
                                                <col style={{ width: '11%' }} />
                                                <col style={{ width: '9%' }} />
                                                <col style={{ width: '4%' }} />
                                                <col style={{ width: '5%' }} />
                                                <col style={{ width: '18%' }} />
                                                <col style={{ width: '10%' }} />
                                                <col style={{ width: '7%' }} />
                                                <col style={{ width: '7%' }} />
                                                <col style={{ width: '7%' }} />
                                                <col style={{ width: '5%' }} />
                                                <col style={{ width: '4%' }} />
                                                <col style={{ width: '4%' }} />
                                            </colgroup>
                                            <thead>
                                                <tr>
                                                    <th className="border border-black px-1.5 py-1.5 font-normal text-center align-middle">PO Number</th>
                                                    <th className="border border-black px-1.5 py-1.5 font-normal text-center align-middle">Supplier</th>
                                                    <th className="border border-black px-1.5 py-1.5 font-normal text-center align-middle">PAR/ICS Number</th>
                                                    <th className="border border-black px-1.5 py-1.5 font-normal text-center align-middle">Qty</th>
                                                    <th className="border border-black px-1.5 py-1.5 font-normal text-center align-middle">Unit</th>
                                                    <th className="border border-black px-1.5 py-1.5 font-normal text-center align-middle">Description</th>
                                                    <th className="border border-black px-1.5 py-1.5 font-normal text-center align-middle">Property Number</th>
                                                    <th className="border border-black px-1.5 py-1.5 font-normal text-center align-middle">Unit Cost</th>
                                                    <th className="border border-black px-1.5 py-1.5 font-normal text-center align-middle">Total Cost</th>
                                                    <th className="border border-black px-1.5 py-1.5 font-normal text-center align-middle">Date Received</th>
                                                    <th className="border border-black px-1.5 py-1.5 font-normal text-center align-middle">Remarks</th>
                                                    <th className="border border-black px-1.5 py-1.5 font-normal text-center align-middle">End User</th>
                                                    <th className="border border-black px-1.5 py-1.5 font-normal text-center align-middle">Scan Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {items.map((item, idx) => (
                                                    <tr key={`${item.inventory_detail_id}-${idx}`} className="h-6">
                                                        <td className="border border-black px-1.5 py-1">{item.po_number}</td>
                                                        <td className="border border-black px-1.5 py-1">{item.supplier}</td>
                                                        <td className="border border-black px-1.5 py-1">{item.par_ics_number}</td>
                                                        <td className="border border-black px-1.5 py-1 text-center">{item.quantity}</td>
                                                        <td className="border border-black px-1.5 py-1 text-center">{item.unit}</td>
                                                        <td className="border border-black px-1.5 py-1">{item.description}</td>
                                                        <td className="border border-black px-1.5 py-1">{item.property_number}</td>
                                                        <td className="border border-black px-1.5 py-1 text-right">{fmt(item.unit_cost)}</td>
                                                        <td className="border border-black px-1.5 py-1 text-right">{fmt(item.total_cost)}</td>
                                                        <td className="border border-black px-1.5 py-1 text-center">{item.date_received}</td>
                                                        <td className="border border-black px-1.5 py-1">{item.remarks}</td>
                                                        <td className="border border-black px-1.5 py-1">{item.end_user}</td>
                                                        <td className="border border-black px-1.5 py-1">{item.scan_status}</td>
                                                    </tr>
                                                ))}

                                                {/* Total row */}
                                                <tr className="print-total-row font-bold h-7">
                                                    <td className="border border-black px-1.5 py-1 text-right" colSpan={7}>
                                                        Total Assets: {items.length} items
                                                    </td>
                                                    <td className="border border-black px-1.5 py-1 text-right">Grand Total:</td>
                                                    <td className="border border-black px-1.5 py-1 text-right">
                                                        PHP {fmt(summary?.total_cost ?? 0)}
                                                    </td>
                                                    <td className="border border-black px-1.5 py-1" colSpan={4}></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );

    return createPortal(content, document.body);
}
import React from 'react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { RpcType, RpcInventoryReportRow } from '@/types/rpcInventory';

interface RpcInventoryPrintViewProps {
    cycleLabel: string;
    type: RpcType;
    generatedAt: string;
    rows: RpcInventoryReportRow[];
    propertyTypes: string[];
    scannedCount: number;
    totalCount: number;
}

const formatDate = (value: string) => {
    const zoned = toZonedTime(new Date(value), 'Asia/Manila');
    return format(zoned, 'MMMM dd, yyyy');
};

const currency = (value: number) => {
    return Number(value || 0).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const ROWS_PER_PAGE = 14;

export function RpcInventoryPrintView({
    cycleLabel,
    type,
    generatedAt,
    rows,
    propertyTypes,
    scannedCount,
    totalCount,
}: RpcInventoryPrintViewProps) {
    const title =
        type === 'RPCPPE'
            ? 'REPORT ON THE PHYSICAL COUNT OF PROPERTY, PLANT AND EQUIPMENT'
            : 'REPORT ON THE PHYSICAL COUNT OF SEMI-EXPENDABLE PROPERTY';

    const subtitle = type === 'RPCPPE' ? '(Type of Property, Plant and Equipment)' : '(Type of Semi-Expendable Property)';
    const reportAsOfDate = formatDate(generatedAt);
    const assumedMonthYear = format(toZonedTime(new Date(generatedAt), 'Asia/Manila'), 'MMMM yyyy').toUpperCase();

    const groupedRows = rows.reduce<Record<string, RpcInventoryReportRow[]>>((acc, row) => {
        const key = (row.property_type || '-').trim() || '-';
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(row);
        return acc;
    }, {});

    const knownPropertyTypes = [...propertyTypes]
        .map((name) => name.trim())
        .filter((name) => name.length > 0)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    const extraPropertyTypes = Object.keys(groupedRows)
        .filter((name) => !knownPropertyTypes.includes(name))
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    const orderedPropertyTypes = [...knownPropertyTypes, ...extraPropertyTypes];

    const printableGroups = orderedPropertyTypes.length > 0
        ? orderedPropertyTypes.map((propertyType) => {
            const sortedRows = [...(groupedRows[propertyType] || [])]
                .sort((a, b) => (a.property_number || '').localeCompare(b.property_number || '', undefined, { sensitivity: 'base' }));

            const pages: RpcInventoryReportRow[][] = [];
            for (let start = 0; start < sortedRows.length; start += ROWS_PER_PAGE) {
                pages.push(sortedRows.slice(start, start + ROWS_PER_PAGE));
            }

            return {
                propertyType,
                pages,
            };
        })
        : [
            {
                propertyType: '-',
                pages: [
                    [
                        {
                            property_type: '-',
                            article: '-',
                            description: 'No rows available for this cycle and report type.',
                            property_number: '-',
                            unit_of_measure: '-',
                            unit_value: 0,
                            quantity_per_card: 0,
                            quantity_per_count: 0,
                            shortage_overage_qty: 0,
                            shortage_overage_value: 0,
                            remarks: '-',
                            accountable_officer: '-',
                            department: '-',
                            condition: '-',
                            is_scanned: false,
                        },
                    ],
                ],
            },
        ];

    const printablePages = printableGroups.flatMap((group) => {
        const totalPagesForType = group.pages.length;
        // Calculate subtotals for this property type
        const allRowsForType = group.pages.flat();
        const subtotals = {
            totalUnitValue: allRowsForType.reduce((sum, row) => sum + ((row.unit_value || 0) * (row.quantity_per_card || 0)), 0),
            totalQuantityPerCard: allRowsForType.reduce((sum, row) => sum + (row.quantity_per_card || 0), 0),
            totalQuantityPerCount: allRowsForType.reduce((sum, row) => sum + (row.quantity_per_count || 0), 0),
        };
        return group.pages.map((pageRows, pageIndex) => ({
            propertyType: group.propertyType,
            rows: pageRows,
            pageNumberForType: pageIndex + 1,
            totalPagesForType,
            isLastPageOfType: pageIndex === totalPagesForType - 1,
            subtotals,
        }));
    });

    const totalPages = printablePages.length;

    return (
        <div className="print-sheet bg-white text-black p-4">
            <style>{`
                .print-sheet {
                    font-family: 'Times New Roman', serif;
                    font-size: 11px;
                    line-height: 1.15;
                }

                .report-page {
                    break-inside: avoid;
                    page-break-inside: avoid;
                    min-height: calc(210mm - 20mm);
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                }

                .report-page + .report-page {
                    break-before: page;
                    page-break-before: always;
                }

                .page-footer {
                    text-align: center;
                    font-size: 10px;
                    padding-top: 12px;
                    margin-top: auto;
                }

                @media print {
                    body * { visibility: hidden !important; }
                    .print-sheet, .print-sheet * { visibility: visible !important; }
                    .print-sheet {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        margin: 0;
                        padding: 0;
                    }
                    .report-page {
                        page-break-inside: avoid;
                        display: flex;
                        flex-direction: column;
                        break-inside: avoid;
                    }
                    .page-footer {
                        page-break-inside: avoid;
                        break-inside: avoid;
                        display: block;
                    }
                }

                @page {
                    size: A4 landscape;
                    margin: 10mm;
                }
            `}</style>

            {printablePages.map((page, pageIndex) => {
                const isLastPageOverall = pageIndex === totalPages - 1;
                return (
                    <section key={`${page.propertyType}-${pageIndex}`} className="report-page">
                        <div className="page-content">
                            <div className="text-center">
                                <div className="font-bold text-[14px]">{title}</div>
                                <div className="font-semibold text-[12px]">{page.propertyType}</div>
                                <div className="text-[11px]">{subtitle}</div>
                                <div className="text-[11px]">As of {reportAsOfDate}</div>
                            </div>

                            {/* Accountability Section - Two rows: text above, labels below */}
                            <div className="mt-2 text-[11px] w-full">
                                {/* Row 1: Accountability Statement */}
                                <div className="text-center leading-tight">
                                    For which <span className="font-semibold">NILO SABAYANON,</span> <span className="font-semibold">OIC-CGSO,</span> <span className="font-semibold">LOCAL GOVERNMENT UNIT OF ELSALVADOR CITY</span> is accountable, having assumed such accountability on <span className="font-semibold">{assumedMonthYear}</span>.
                                </div>

                                {/* Row 2: Labels Below */}
                                {/* <div className="text-center text-[10px] mt-2 flex justify-center gap-8">
                                <div className="w-32 text-center">
                                    <div>(Name of Accountable officer)</div>
                                </div>
                                <div className="w-28 text-center">
                                    <div>(Official Designation)</div>
                                </div>
                                <div className="w-40 text-center">
                                    <div>(LGU)</div>
                                </div>
                                <div className="w-24 text-center">
                                    <div>(Date of Assumption)</div>
                                </div>
                            </div> */}
                            </div>

                            <div className="mt-3 overflow-hidden">
                                <table className="w-full border-collapse text-[10px]">
                                    <thead>
                                        <tr>
                                            <th rowSpan={2} className="border border-black px-1 py-1">Article</th>
                                            <th rowSpan={2} className="border border-black px-1 py-1">Description</th>
                                            <th rowSpan={2} className="border border-black px-1 py-1">PROPERTY NUMBER</th>
                                            <th rowSpan={2} className="border border-black px-1 py-1">Unit of Measure</th>
                                            <th colSpan={2} className="border border-black px-1 py-1">UNIT VALUE</th>
                                            <th className="border border-black px-1 py-1">BALANCE PER CARD</th>
                                            <th className="border border-black px-1 py-1">ON HAND PER COUNT</th>
                                            <th colSpan={2} className="border border-black px-1 py-1">SHORTAGE/OVERAGE</th>
                                            <th rowSpan={2} className="border border-black px-1 py-1">Remarks</th>
                                            <th rowSpan={2} className="border border-black px-1 py-1">End User</th>
                                            <th rowSpan={2} className="border border-black px-1 py-1">Department</th>
                                        </tr>
                                        <tr>
                                            <th className="border border-black px-1 py-1">Unit Cost</th>
                                            <th className="border border-black px-1 py-1">Total Cost</th>
                                            <th className="border border-black px-1 py-1">(Quantity)</th>
                                            <th className="border border-black px-1 py-1">(Quantity)</th>
                                            <th className="border border-black px-1 py-1">Quantity</th>
                                            <th className="border border-black px-1 py-1">Value</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(page.rows.length > 0 ? page.rows : [null]).map((row, index) => (
                                            <tr key={`${page.propertyType}-${row?.property_number || 'empty'}-${index}`}>
                                                <td className="border border-black px-1 py-1">{row?.article || ''}</td>
                                                <td className="border border-black px-1 py-1">{row?.description || ''}</td>
                                                <td className="border border-black px-1 py-1">{row?.property_number || ''}</td>
                                                <td className="border border-black px-1 py-1 text-center">{row?.unit_of_measure || ''}</td>
                                                <td className="border border-black px-1 py-1 text-right">{row ? currency(row.unit_value || 0) : ''}</td>
                                                <td className="border border-black px-1 py-1 text-right">{row ? currency((row.unit_value || 0) * (row.quantity_per_card || 0)) : ''}</td>
                                                <td className="border border-black px-1 py-1 text-center">{row?.quantity_per_card ?? ''}</td>
                                                <td className="border border-black px-1 py-1 text-center">{row?.quantity_per_count ?? ''}</td>
                                                <td className="border border-black px-1 py-1 text-center">{row?.shortage_overage_qty ?? ''}</td>
                                                <td className="border border-black px-1 py-1 text-right">{row ? currency(row.shortage_overage_value || 0) : ''}</td>
                                                <td className="border border-black px-1 py-1">{row?.remarks || ''}</td>
                                                <td className="border border-black px-1 py-1">{row?.accountable_officer || ''}</td>
                                                <td className="border border-black px-1 py-1">{row?.department || ''}</td>
                                            </tr>
                                        ))}
                                        {page.isLastPageOfType && (
                                            <tr>
                                                <td colSpan={5} className="px-1 py-1 text-right">TOTAL</td>
                                                <td className="px-1 py-1 text-right">{currency(page.subtotals.totalUnitValue)}</td>
                                                <td className="px-1 py-1 text-center">{page.subtotals.totalQuantityPerCard}</td>
                                                <td className="px-1 py-1 text-center">{page.subtotals.totalQuantityPerCount}</td>
                                                <td colSpan={5} className="px-1 py-1"></td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {page.isLastPageOfType && (
                                <>
                                    <div className="mt-6 grid grid-cols-3 gap-6 text-[11px]">
                                        <div>
                                            <div>Prepared by:</div>
                                            <div className="h-10" />
                                            <div className="border-b border-black" />
                                            <div className="text-center">Supply Officer</div>
                                        </div>
                                        <div>
                                            <div>Certified Correct by:</div>
                                            <div className="h-10" />
                                            <div className="border-b border-black" />
                                            <div className="text-center">City Accountant</div>
                                        </div>
                                        <div>
                                            <div>Approved by:</div>
                                            <div className="h-10" />
                                            <div className="border-b border-black" />
                                            <div className="text-center">City Mayor</div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {isLastPageOverall && (
                                <>
                                    {/* <div className="mt-2 text-[11px]">
                                        <span className="font-semibold">Summary:</span> Scanned {scannedCount} of {totalCount} items.
                                    </div> */}
                                </>
                            )}
                        </div>

                        <div className="page-footer">Page {page.pageNumberForType} of {page.totalPagesForType}</div>
                    </section>
                );
            })}
        </div>
    );
}

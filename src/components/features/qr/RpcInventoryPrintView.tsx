import React from 'react';
import { compressPropertyNumbers } from '@/lib/utils/propertyNumbers';
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
    return format(zoned, 'M/d/yyyy');
};

// Formats the End User depending on the report type (Always ALL CAPS, no department)
const formatPrintEndUser = (type: RpcType, accountableOfficer?: string | null) => {
    if (!accountableOfficer) return '';

    // Split out any appended department suffix if it exists after a hyphen
    const cleanName = accountableOfficer.split('-')[0].trim();

    // RPCPPE: Initial style (e.g., "A. MICARTE")
    if (type === 'RPCPPE') {
        const nameParts = cleanName.split(/\s+/).filter(Boolean);

        if (nameParts.length === 0) return '';
        if (nameParts.length === 1) return nameParts[0].toUpperCase();

        const firstInitial = `${nameParts[0][0].toUpperCase()}.`;
        const lastNameParts = nameParts.slice(1).join(' ').toUpperCase();

        return `${firstInitial} ${lastNameParts}`;
    }

    // RPCSEP: Full Name style in Caps (e.g., "AARON MICARTE")
    return cleanName.toUpperCase();
};

// Extracts the department from the accountable_officer string and forces it to ALL CAPS
const extractDepartment = (accountableOfficer?: string | null) => {
    if (!accountableOfficer) return '';
    const parts = accountableOfficer.split('-');
    if (parts.length > 1) {
        return parts.slice(1).join('-').trim().toUpperCase(); // Returns everything after the first "-" in ALL CAPS
    }
    return '';
};

const currency = (value: number) => {
    return Number(Math.abs(value || 0)).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const normalizeSortText = (value?: string | null) => (value || '').trim().toLocaleLowerCase();

const compareReportRows = (left: RpcInventoryReportRow, right: RpcInventoryReportRow) => {
    const leftKey = [left.article, left.description].map(normalizeSortText).join(' | ');
    const rightKey = [right.article, right.description].map(normalizeSortText).join(' | ');

    const byItem = leftKey.localeCompare(rightKey, undefined, { sensitivity: 'base' });
    if (byItem !== 0) return byItem;

    return normalizeSortText(left.property_number).localeCompare(normalizeSortText(right.property_number), undefined, { sensitivity: 'base' });
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
    const year = format(toZonedTime(new Date(generatedAt || new Date()), 'Asia/Manila'), 'yyyy');
    const reportAsOfDate = `DECEMBER 31, ${year}`;

    const assumedMonthYear = `DECEMEBER ${year}`;

    const groupedRows = rows.reduce<Record<string, RpcInventoryReportRow[]>>((acc, row) => {
        const key = (row.property_type || '').trim();
        if (!acc[key]) acc[key] = [];
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
            const sortedRows = [...(groupedRows[propertyType] || [])].sort(compareReportRows);

            const pages: RpcInventoryReportRow[][] = [];
            for (let start = 0; start < sortedRows.length; start += ROWS_PER_PAGE) {
                pages.push(sortedRows.slice(start, start + ROWS_PER_PAGE));
            }

            return { propertyType, pages };
        })
        : [
            {
                propertyType: '',
                pages: [
                    [
                        {
                            property_type: '',
                            article: '',
                            description: 'No rows available for this cycle and report type.',
                            property_number: '',
                            unit_of_measure: '',
                            unit_value: 0,
                            quantity_per_card: 0,
                            quantity_per_count: 0,
                            shortage_overage_qty: 0,
                            shortage_overage_value: 0,
                            remarks: '',
                            accountable_officer: '',
                            date_purchased: '',
                            condition: '',
                            is_scanned: false,
                        },
                    ],
                ],
            },
        ];

    const printablePages = printableGroups.flatMap((group) => {
        const totalPagesForType = group.pages.length;
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

    // Transforms main row layout to all caps when rendering RPCPPE layout
    const isPpe = type === 'RPCPPE';
    const mainHeaderClass = `border border-black px-1 py-1 font-normal ${isPpe ? 'uppercase' : ''}`;

    return (
        <div className="gso-print-doc bg-white text-black p-4">
            <style>{`
    .print-sheet { font-family: 'Times New Roman', serif; font-size: 11px; line-height: 1.15; }
    .report-page { break-inside: avoid; page-break-inside: avoid; min-height: calc(210mm - 20mm); display: flex; flex-direction: column; box-sizing: border-box; }
    .report-page + .report-page { break-before: page; page-break-before: always; }
    .page-footer { text-align: center; font-size: 10px; padding-top: 12px; margin-top: auto; }
    
    @media print {
        @page { 
            size: 13in 8.5in landscape;
            margin: 10mm 15mm; 
        }
        
        body * {
            visibility: hidden !important;
        }
        
        .gso-print-doc, .gso-print-doc * {
            visibility: visible !important;
        }
        
        .gso-print-doc {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: #fff !important;
            padding: 0 !important;
            margin: 0 !important;
        }

        #tsqd-parent,
        [id*="tsqd"],
        [id*="tanstack"],
        [class*="tanstack"],
        [class*="TanStack"],
        tsqd-devtools,
        button {
            display: none !important;
            opacity: 0 !important;
            visibility: hidden !important;
            width: 0 !important;
            height: 0 !important;
        }
    }
`}</style>

            {printablePages.map((page, pageIndex) => {
                return (
                    <section key={`${page.propertyType}-${pageIndex}`} className="report-page">
                        <div className="page-content">
                            <div className="text-center">
                                <div className="font-bold text-[14px]">{title}</div>
                                <div className="font-bold text-[12px]">{page.propertyType}</div>
                                <div className="text-[11px]">{subtitle}</div>
                                <div className="font-bold text-[11px]">As of {reportAsOfDate}</div>
                            </div>

                            <div className="mt-2 text-[11px] w-full">
                                <div className="text-center leading-tight">
                                    For which <span className="font-bold">NILO SABAYANON,</span> <span className="font-bold">OIC-CGSO,</span> <span className="font-bold">LOCAL GOVERNMENT UNIT OF ELSALVADOR CITY</span> is accountable, having assumed such accountability on <span className="font-bold">{assumedMonthYear}</span>.
                                </div>
                            </div>

                            <div className="mt-3 overflow-hidden">
                                <table className="w-full border-collapse text-[10px]">
                                    <thead>
                                        <tr>
                                            <th rowSpan={2} className={mainHeaderClass}>Article</th>
                                            <th rowSpan={2} className={mainHeaderClass}>Description</th>
                                            <th rowSpan={2} className={mainHeaderClass}>
                                                {type === 'RPCPPE' ? 'Property Number' : 'Semi-Expendable Property No.'}
                                            </th>
                                            <th rowSpan={2} className={mainHeaderClass}>Unit of Measure</th>
                                            <th colSpan={2} className={mainHeaderClass}>Unit Value</th>
                                            <th className={mainHeaderClass}>Balance Per Card</th>
                                            <th className={mainHeaderClass}>On Hand Per Count</th>
                                            <th colSpan={2} className={mainHeaderClass}>Shortage/Overage</th>
                                            <th rowSpan={2} className={mainHeaderClass}>Remarks</th>
                                            <th rowSpan={2} className={mainHeaderClass}>End User</th>
                                            <th rowSpan={2} className={mainHeaderClass}>
                                                {type === 'RPCPPE' ? 'Date Purchase' : 'Department'}
                                            </th>
                                        </tr>
                                        <tr>
                                            {/* Sub-headers specified in image_4afe85.png maintain their case layout perfectly */}
                                            <th className="border border-black px-1 py-1 font-normal">Unit Cost</th>
                                            <th className="border border-black px-1 py-1 font-normal">Total Cost</th>
                                            <th className="border border-black px-1 py-1 font-normal">(Quantity)</th>
                                            <th className="border border-black px-1 py-1 font-normal">(Quantity)</th>
                                            <th className="border border-black px-1 py-1 font-normal">Quantity</th>
                                            <th className="border border-black px-1 py-1 font-normal">Value</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(page.rows.length > 0 ? page.rows : [null]).map((row, index) => (
                                            <tr key={`${page.propertyType}-${row?.property_number || 'empty'}-${index}`}>
                                                <td className="border border-black px-1 py-1">{row?.article || ''}</td>
                                                <td className="border border-black px-1 py-1">{row?.description || ''}</td>
                                                <td className="border border-black px-1 py-1">{row ? compressPropertyNumbers(row.property_number) : ''}</td>
                                                <td className="border border-black px-1 py-1 text-center">{row?.unit_of_measure || ''}</td>
                                                <td className="border border-black px-1 py-1 text-right">{row ? currency(row.unit_value || 0) : ''}</td>
                                                <td className="border border-black px-1 py-1 text-right">{row ? currency((row.unit_value || 0) * (row.quantity_per_card || 0)) : ''}</td>
                                                <td className="border border-black px-1 py-1 text-center">{row?.quantity_per_card ?? ''}</td>
                                                <td className="border border-black px-1 py-1 text-center">{row?.quantity_per_count ?? ''}</td>
                                                <td className="border border-black px-1 py-1 text-center">
                                                    {row?.shortage_overage_qty !== undefined && row?.shortage_overage_qty !== null
                                                        ? Math.abs(row.shortage_overage_qty)
                                                        : ''}
                                                </td>
                                                <td className="border border-black px-1 py-1 text-right">{row ? currency(row.shortage_overage_value || 0) : ''}</td>
                                                <td className="border border-black px-1 py-1">
                                                    {row ? (() => {
                                                        if (row.remarks && row.remarks !== '-') return row.remarks;

                                                        const expected = Number(row.quantity_per_card || 0);
                                                        const counted = Number(row.quantity_per_count || 0);
                                                        const notFound = expected - counted;

                                                        if (expected > 0) {
                                                            if (notFound <= 0) return '';
                                                            if (notFound === expected) return 'Not Found';
                                                            return `${notFound} Not Found`;
                                                        }

                                                        if (row.property_remarks && Object.keys(row.property_remarks).length > 0) {
                                                            return Object.entries(row.property_remarks)
                                                                .map(([pn, rm]) => `${pn}: ${rm ?? ''}`)
                                                                .join('; ');
                                                        }

                                                        return '';
                                                    })() : ''}
                                                </td>
                                                <td className="border border-black px-1 py-1">
                                                    {row ? formatPrintEndUser(type, row.accountable_officer) : ''}
                                                </td>
                                                <td className="border border-black px-1 py-1 text-center">
                                                    {row ? (
                                                        type === 'RPCPPE' ? (
                                                            row.date_purchased && row.date_purchased !== '-' ? formatDate(row.date_purchased) : ''
                                                        ) : (
                                                            extractDepartment(row.accountable_officer)
                                                        )
                                                    ) : ''}
                                                </td>
                                            </tr>
                                        ))}
                                        {page.isLastPageOfType && (
                                            <tr>
                                                <td colSpan={3} className="px-1 py-1"></td>
                                                <td className="px-1 py-1 text-center font-normal">TOTAL</td>
                                                <td colSpan={2} className="px-1 py-1 text-center font-normal">{currency(page.subtotals.totalUnitValue)}</td>
                                                <td className="px-1 py-1 text-center font-normal">{page.subtotals.totalQuantityPerCard}</td>
                                                <td className="px-1 py-1 text-center font-normal">{page.subtotals.totalQuantityPerCount}</td>
                                                <td colSpan={5} className="px-1 py-1"></td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {page.isLastPageOfType && (
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
                            )}
                        </div>

                        <div className="page-footer">Page {page.pageNumberForType} of {page.totalPagesForType}</div>
                    </section>
                );
            })}
        </div>
    );
}
import React from 'react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { RsmiReport, RsmiReportItem } from '@/types/rsmi';

interface RsmiPrintViewProps {
    report: RsmiReport;
    batchMode?: boolean;
    custodianName?: string;
}

const formatPHDate = (dateString?: string | null) => {
    if (!dateString) return '';
    return format(toZonedTime(new Date(dateString), 'Asia/Manila'), 'MM/dd/yyyy');
};

const text = (value: unknown, fallback = '') => {
    const t = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
    return t.length > 0 ? t : fallback;
};

const parseTrailingNumber = (value: string): { prefix: string; number: number; width: number } | null => {
    const trimmed = value.trim();
    const match = trimmed.match(/^(.*?)(\d+)$/);
    if (!match) return null;
    const numberText = match[2];
    return {
        prefix: match[1],
        number: Number(numberText),
        width: numberText.length,
    };
};

const formatStockRange = (values: string[]): string => {
    const unique = Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
    if (unique.length === 0) return '';
    if (unique.length === 1) return unique[0];

    const parsed = unique.map((value) => ({ value, parsed: parseTrailingNumber(value) }));
    const firstParsed = parsed[0].parsed;
    const canCompact = !!firstParsed && parsed.every((item) => (
        item.parsed
        && item.parsed.prefix === firstParsed.prefix
        && item.parsed.width === firstParsed.width
    ));

    if (canCompact) {
        const sorted = parsed
            .map((item) => ({
                parsed: item.parsed!,
            }))
            .sort((a, b) => a.parsed.number - b.parsed.number);

        const blocks: string[] = [];
        let start = sorted[0].parsed.number;
        let previous = sorted[0].parsed.number;

        const pushBlock = (rangeStart: number, rangeEnd: number) => {
            const startFull = `${firstParsed.prefix}${String(rangeStart).padStart(firstParsed.width, '0')}`;
            if (rangeStart === rangeEnd) {
                blocks.push(startFull);
                return;
            }
            const endSuffix = String(rangeEnd).padStart(firstParsed.width, '0');
            blocks.push(`${startFull}/${endSuffix}`);
        };

        for (let i = 1; i < sorted.length; i++) {
            const current = sorted[i].parsed.number;
            if (current !== previous + 1) {
                pushBlock(start, previous);
                start = current;
            }
            previous = current;
        }

        pushBlock(start, previous);

        return blocks.join(', ');
    }

    return unique.slice().sort((a, b) => a.localeCompare(b)).join(', ');
};

const emptyDetailsRow = (id: number) => ({
    id,
    ris_no: '',
    responsibility_center_code: '',
    stock_no: '',
    item_description: '',
    unit: '',
    quantity_issued: 0,
});

export const RsmiPrintView = React.forwardRef<HTMLDivElement, RsmiPrintViewProps>(
    ({ report, batchMode = false, custodianName }, ref) => {
        const detailRows = 8;
        const recapRows = 4;

        const details = [...(report.items ?? [])];
        const itemMap = new Map<string, { item: RsmiReportItem; stockNos: string[] }>();

        for (const item of details) {
            const key = [item.ris_no, item.responsibility_center_code, item.item_description, item.unit].join('||');
            const existing = itemMap.get(key);

            if (existing) {
                existing.item.quantity_issued += Number(item.quantity_issued ?? 0);
                if (item.stock_no) {
                    existing.stockNos.push(item.stock_no);
                }
            } else {
                itemMap.set(key, {
                    item: {
                        ...item,
                        quantity_issued: Number(item.quantity_issued ?? 0),
                    },
                    stockNos: item.stock_no ? [item.stock_no] : [],
                });
            }
        }

        const displayDetails = [...itemMap.values()]
            .map(({ item, stockNos }) => ({
                ...item,
                stock_no: formatStockRange(stockNos),
            }))
            .sort((a, b) => {
                const risCompare = String(a.ris_no ?? '').localeCompare(String(b.ris_no ?? ''));
                if (risCompare !== 0) return risCompare;
                return String(a.stock_no ?? '').localeCompare(String(b.stock_no ?? ''));
            });

        while (displayDetails.length < detailRows) {
            displayDetails.push(emptyDetailsRow(-(displayDetails.length + 1)));
        }

        const recapMap = new Map<string, { stockNos: string[]; quantity: number }>();

        for (const item of details) {
            const key = [item.item_description, item.unit].join('||');
            const existing = recapMap.get(key);

            if (existing) {
                existing.quantity += Number(item.quantity_issued ?? 0);
                if (item.stock_no) {
                    existing.stockNos.push(item.stock_no);
                }
            } else {
                recapMap.set(key, {
                    stockNos: item.stock_no ? [item.stock_no] : [],
                    quantity: Number(item.quantity_issued ?? 0),
                });
            }
        }

        const recapitulation = [...recapMap.values()]
            .map(({ stockNos, quantity }) => ({
                stock_no: formatStockRange(stockNos),
                quantity,
            }))
            .sort((a, b) => a.stock_no.localeCompare(b.stock_no));

        while (recapitulation.length < recapRows) {
            recapitulation.push({ stock_no: '', quantity: 0 });
        }

        return (
            <div ref={ref} className="print-container bg-white p-2 max-w-[1200px] mx-auto text-black">
                <style>{`
                    .print-container {
                        font-family: 'Times New Roman', serif;
                        font-size: 12px;
                        line-height: 1.1;
                    }

                    @media print {
                        body * {
                            visibility: hidden !important;
                        }
                        .print-container,
                        .print-container * {
                            visibility: visible !important;
                        }
                        .print-container {
                            padding: 0;
                            margin: 0;
                            max-width: none;
                            width: 100%;
                        }
                        ${batchMode
                        ? ''
                        : `
                        .print-container {
                            position: absolute;
                            left: 0;
                            top: 0;
                        }
                        `
                    }
                        .rsmi-main-table thead {
                            display: table-row-group;
                        }
                        .no-print { display: none !important; }
                    }

                    @page {
                        size: A4 landscape;
                        margin: 8mm;
                    }
                `}</style>

                <div className="text-center font-bold text-[20px] mb-2 tracking-wide">REPORT OF SUPPLIES AND MATERIALS ISSUED</div>

                <div className="grid grid-cols-2 gap-6 mb-2 text-[16px]">
                    <div className="space-y-1">
                        <div className="flex items-end gap-2">
                            <span className="font-bold">Entity Name:</span>
                            <span className="border-b border-black flex-1 h-[20px]">{text(report.entity_name)}</span>
                        </div>
                        <div className="flex items-end gap-2">
                            <span className="font-bold">Fund Cluster:</span>
                            <span className="border-b border-black flex-1 h-[20px]">{text(report.fund_cluster)}</span>
                        </div>
                    </div>
                    <div className="space-y-1 pr-10">
                        <div className="flex items-end justify-end gap-2">
                            <span className="font-bold">Serial No. :</span>
                            <span className="border-b border-black w-[230px] h-[20px]">{text(report.serial_no, '')}</span>
                        </div>
                        <div className="flex items-end justify-end gap-2">
                            <span className="font-bold">Date :</span>
                            <span className="border-b border-black w-[230px] h-[20px]">{text(report.report_date_label, formatPHDate(report.report_date))}</span>
                        </div>
                    </div>
                </div>

                <table className="rsmi-main-table w-full border-collapse text-[16px]">
                    <colgroup>
                        <col className="w-[13%]" />
                        <col className="w-[17%]" />
                        <col className="w-[12%]" />
                        <col className="w-[14%]" />
                        <col className="w-[11%]" />
                        <col className="w-[10%]" />
                        <col className="w-[12%]" />
                        <col className="w-[11%]" />
                    </colgroup>
                    <thead>
                        <tr>
                            <th colSpan={6} className="border border-black italic font-normal py-1">
                                To be filled up by the Supply and/or Property Division/Unit
                            </th>
                            <th colSpan={2} className="border border-black italic font-normal py-1">
                                To be filled up by the Accounting Division/Unit
                            </th>
                        </tr>
                        <tr>
                            <th className="border border-black py-1">RIS No.</th>
                            <th className="border border-black py-1">Responsibility Center Code</th>
                            <th className="border border-black py-1">Stock No.</th>
                            <th className="border border-black py-1">Item</th>
                            <th className="border border-black py-1">Unit</th>
                            <th className="border border-black py-1">Quantity Issued</th>
                            <th className="border border-black py-1">Unit Cost</th>
                            <th className="border border-black py-1">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayDetails.map((item, idx) => (
                            <tr key={item.id ?? idx}>
                                <td className="border border-black h-[24px] px-1">{item.ris_no === 'N/A' ? '' : text(item.ris_no)}</td>
                                <td className="border border-black h-[24px] px-1">{text(item.responsibility_center_code)}</td>
                                <td className="border border-black h-[24px] px-1" title={item.stock_no ? `Stock: ${item.stock_no}` : ''}>{text(item.stock_no)}</td>
                                <td className="border border-black h-[24px] px-1">{text(item.item_description)}</td>
                                <td className="border border-black h-[24px] px-1">{text(item.unit)}</td>
                                <td className="border border-black h-[24px] px-1 text-right">{item.quantity_issued > 0 ? item.quantity_issued : ''}</td>
                                <td className="border border-black h-[24px] px-1" />
                                <td className="border border-black h-[24px] px-1" />
                            </tr>
                        ))}
                    </tbody>
                    <tbody>
                        <tr>
                            <td className="border border-black" />
                            <td colSpan={2} className="border border-black text-center font-bold py-1">Recapitulation:</td>
                            <td className="border border-black" />
                            <td className="border border-black" />
                            <td className="border border-black" />
                            <td colSpan={2} className="border border-black text-center font-bold py-1">Recapitulation:</td>
                        </tr>
                        <tr>
                            <td className="border border-black" />
                            <td className="border border-black py-1">Stock No.</td>
                            <td className="border border-black py-1">Quantity</td>
                            <td className="border border-black" />
                            <td className="border border-black" />
                            <td className="border border-black" />
                            <td className="border border-black py-1">Unit Cost</td>
                            <td className="border border-black py-1">Total Cost</td>
                        </tr>
                        {recapitulation.map((row, idx) => (
                            <tr key={`${row.stock_no}-${idx}`}>
                                <td className="border border-black" />
                                <td className="border border-black h-[24px] px-1">{text(row.stock_no)}</td>
                                <td className="border border-black h-[24px] px-1 text-right">{row.quantity > 0 ? row.quantity : ''}</td>
                                <td className="border border-black" />
                                <td className="border border-black" />
                                <td className="border border-black" />
                                <td className="border border-black h-[24px]" />
                                <td className="border border-black h-[24px]" />
                            </tr>
                        ))}
                        {Array.from({ length: recapRows }).map((_, idx) => (
                            <tr key={`accounting-row-${idx}`}>
                                <td className="border border-black" />
                                <td className="border border-black" />
                                <td className="border border-black" />
                                <td className="border border-black" />
                                <td className="border border-black" />
                                <td className="border border-black" />
                                <td className="border border-black h-[24px]" />
                                <td className="border border-black h-[24px]" />
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="grid grid-cols-[58%_42%] border-l border-r border-b border-black min-h-[110px] text-[16px]">
                    <div className="border-r border-black p-3 flex flex-col justify-between">
                        <p>I hereby certify to the correctness of the above information.</p>
                        <div className="px-12 pb-1">
                            <div className="h-5 text-center leading-tight">{text(custodianName)}</div>
                            <div className="border-b border-black w-full" />
                            <div className="text-center mt-1 leading-tight">Signature over Printed Name of Supply and/or Property Custodian</div>
                        </div>
                    </div>
                    <div className="p-3 flex flex-col justify-between">
                        <div>Posted by:</div>
                        <div className="grid grid-cols-[1fr_170px] gap-8 items-end px-2 pb-1">
                            <div>
                                <div className="h-5" />
                                <div className="border-b border-black w-full" />
                                <div className="text-center mt-1 leading-tight">Signature over Printed Name of Designated Accounting Staff</div>
                            </div>
                            <div>
                                <div className="h-8" />
                                <div className="border-b border-black w-full" />
                                <div className="text-center mt-2">Date</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    });

RsmiPrintView.displayName = 'RsmiPrintView';

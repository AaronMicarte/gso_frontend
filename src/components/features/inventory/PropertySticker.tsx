'use client';

import React, { useCallback, useState, useMemo } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { QrCode, X, Printer } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

export interface PropertyStickerItem {
    propertyNumber: string;
    custodianName?: string;
    itemName?: string;
    category?: string;
    date?: string;
    unitCost?: number | string | null;
    url: string;
}

interface PropertyStickerProps {
    propertyNumber?: string;
    description?: string;
    department?: string;
    url?: string;
    custodianName?: string;
    itemName?: string;
    category?: string;
    date?: string;
    classification?: string;
    acquisitionDate?: string;
    unitCost?: number | string | null;

    items?: PropertyStickerItem[];
}

const escapeHtml = (s?: string | null) => {
    if (!s) return '';
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

export function PropertySticker({
    propertyNumber,
    description,
    department,
    url,
    custodianName = 'Unassigned',
    itemName,
    category,
    date,
    classification = '-',
    acquisitionDate = '-',
    unitCost,
    items
}: PropertyStickerProps) {
    const [open, setOpen] = useState(false);

    const resolvedItems = useMemo<PropertyStickerItem[]>(() => {
        if (items && items.length > 0) {
            return items;
        }
        return [
            {
                propertyNumber: propertyNumber || '',
                custodianName: custodianName || 'Unassigned',
                itemName: itemName || description || '-',
                category: category || classification || '-',
                date: date || acquisitionDate || '-',
                unitCost: unitCost,
                url: url || '',
            },
        ];
    }, [
        items,
        propertyNumber,
        custodianName,
        itemName,
        description,
        category,
        classification,
        date,
        acquisitionDate,
        unitCost,
        url,
    ]);

    const handlePrintItems = useCallback((itemsToPrint: PropertyStickerItem[], startIdx: number) => {
        const qrDataUrls: string[] = [];
        itemsToPrint.forEach((_, subIdx) => {
            const globalIdx = startIdx + subIdx;
            const canvas = document.querySelector<HTMLCanvasElement>(
                `[data-sticker-qr="qr-${globalIdx}"] canvas`
            );
            if (canvas) {
                qrDataUrls.push(canvas.toDataURL('image/png'));
            } else {
                qrDataUrls.push('');
            }
        });

        const printWindow = window.open('', 'gso-property-sticker-print');
        if (!printWindow) return;

        // Group into pages of 2 stickers
        const pages: PropertyStickerItem[][] = [];
        for (let i = 0; i < itemsToPrint.length; i += 2) {
            pages.push(itemsToPrint.slice(i, i + 2));
        }

        const pagesHtml = pages.map((pageItems, pageIdx) => {
            const stickersHtml = pageItems.map((item, itemIdx) => {
                const qrUrl = qrDataUrls[pageIdx * 2 + itemIdx];
                return `
        <div class="sticker">
            <div>
                <div class="title">ITEM ${escapeHtml(item.propertyNumber)}</div>
                <div class="field">
                    <div class="field-label">Name:</div>
                    <div class="field-value">${escapeHtml(item.custodianName || '-')}</div>
                </div>
                <div class="field">
                    <div class="field-label">Article:</div>
                    <div class="field-value">${escapeHtml(item.itemName || '-')}</div>
                </div>
                <div class="field">
                    <div class="field-label">Classification:</div>
                    <div class="field-value">${escapeHtml(item.category || '-')}</div>
                </div>
                <div class="field">
                    <div class="field-label">PR Number:</div>
                    <div class="field-value">${escapeHtml(item.propertyNumber)}</div>
                </div>
                <div class="field">
                    <div class="field-label">Date:</div>
                    <div class="field-value">${escapeHtml(item.date || '-')}</div>
                </div>
            </div>
            <div class="qr-wrap">
                <div class="qr-box">
                    ${qrUrl
                        ? `<img src="${qrUrl}" alt="QR Code" />`
                        : `<div style="width:160px;height:160px;display:flex;align-items:center;justify-content:center;color:#94a3b8;">QR unavailable</div>`
                    }
                </div>
            </div>
        </div>`;
            }).join('');

            return `
        <div class="page-wrapper">
            ${stickersHtml}
        </div>`;
        }).join('');

        const html = `
<!doctype html>
<html>
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Property Stickers</title>
        <style>
            @page { size: legal landscape; margin: 10mm; }
            * { box-sizing: border-box; }
            html, body { height: 100%; margin: 0; padding: 0; background: #fff; }
            body {
                font-family: Helvetica, Arial, sans-serif;
            }
            .page-wrapper {
                height: 100vh;
                display: flex;
                flex-direction: column;
                justify-content: flex-start;
                gap: 20px;
                padding: 10px 0;
                box-sizing: border-box;
                page-break-after: always;
                break-after: page;
            }
            .page-wrapper:last-child {
                page-break-after: avoid;
                break-after: avoid;
            }
            .sticker {
                 display: grid;
                 grid-template-columns: 1fr 220px;
                 gap: 24px;
                 align-items: center;
                 padding: 24px;
                 border: 2px solid #94a3b8;
                 box-sizing: border-box;
                 page-break-inside: avoid;
                 break-inside: avoid;
                 height: calc(50% - 10px);
                 max-width: 900px;
                 margin: 0 auto;
                 width: 100%;
            }
            .title {
                font-size: 22px;
                font-weight: 800;
                letter-spacing: 0.05em;
                color: #2563eb;
                margin-bottom: 20px;
            }
            .field {
                display: flex;
                align-items: flex-end;
                gap: 12px;
                margin-bottom: 16px;
                color: #2563eb;
                font-size: 15px;
            }
            .field-label {
                width: 100px;
                flex-shrink: 0;
            }
            .field-value {
                flex: 1;
                border-bottom: 1px solid #60a5fa;
                padding-bottom: 2px;
                color: #0f172a;
            }
            .qr-wrap {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
            }
            .qr-box {
                background: #fff;
                padding: 10px;
                box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
                border: 1px solid #e2e8f0;
            }
            .qr-box img {
                width: 160px;
                height: 160px;
                display: block;
            }
        </style>
    </head>
    <body>
        ${pagesHtml}
        <script>
            window.onload = function () {
                window.focus();
                setTimeout(function() {
                    window.print();
                }, 250);
            };
            window.onafterprint = function () {
                window.close();
            };
        </script>
    </body>
</html>`;

        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
    }, []);

    const handlePrintAll = useCallback(() => {
        handlePrintItems(resolvedItems, 0);
    }, [resolvedItems, handlePrintItems]);

    const handlePrintSingle = useCallback((item: PropertyStickerItem, idx: number) => {
        handlePrintItems([item], idx);
    }, [handlePrintItems]);

    return (
        <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
                <button
                    className="p-2 text-slate-400 hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded-lg transition-colors"
                    title="View Property Sticker"
                >
                    <QrCode className="w-5 h-5" />
                </button>
            </Dialog.Trigger>

            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm" />
                <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-5xl bg-white rounded-xl shadow-2xl z-50 p-0 overflow-hidden outline-none flex flex-col max-h-[90vh]">
                    <Dialog.Title className="sr-only">Property Sticker</Dialog.Title>
                    
                    {/* Sticky Header */}
                    <div className="sticky top-0 z-10 flex items-center justify-between pl-10 pr-16 py-4 border-b border-slate-200 bg-slate-50">
                        <h3 className="text-lg font-semibold text-slate-900">
                            {resolvedItems.length > 1 ? `Property Stickers (${resolvedItems.length} items)` : 'Property Sticker'}
                        </h3>
                        <button
                            type="button"
                            onClick={handlePrintAll}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium shadow-sm"
                        >
                            <Printer className="w-4 h-4" />
                            {resolvedItems.length > 1 ? 'Print All Stickers' : 'Print Property Sticker'}
                        </button>
                    </div>

                    <Dialog.Close asChild>
                        <button className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors z-20">
                            <X className="w-5 h-5" />
                        </button>
                    </Dialog.Close>

                    <div className="flex-1 overflow-y-auto p-10 space-y-12 divide-y divide-slate-200" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                        {resolvedItems.map((item, idx) => (
                            <div key={idx} className={idx > 0 ? "pt-12" : ""}>
                                <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-10 items-start">
                                    <div>
                                        <div className="text-3xl font-extrabold tracking-wide text-blue-600 mb-10">
                                            ITEM {item.propertyNumber}
                                        </div>

                                        <div className="space-y-6 text-blue-600">
                                            <div className="flex items-end gap-4">
                                                <div className="w-28 text-lg">Name:</div>
                                                <div className="flex-1 border-b border-blue-400 pb-1 text-slate-900 text-lg">
                                                    {item.custodianName || '-'}
                                                </div>
                                            </div>

                                            <div className="flex items-end gap-4">
                                                <div className="w-28 text-lg">Article:</div>
                                                <div className="flex-1 border-b border-blue-400 pb-1 text-slate-900 text-lg">
                                                    {item.itemName || '-'}
                                                </div>
                                            </div>

                                            <div className="flex items-end gap-4">
                                                <div className="w-28 text-lg">Classification:</div>
                                                <div className="flex-1 border-b border-blue-400 pb-1 text-slate-900 text-lg">
                                                    {item.category || '-'}
                                                </div>
                                            </div>

                                            <div className="flex items-end gap-4">
                                                <div className="w-28 text-lg">PR Number:</div>
                                                <div className="flex-1 border-b border-blue-400 pb-1 text-slate-900 text-lg">
                                                    {item.propertyNumber || '-'}
                                                </div>
                                            </div>

                                            <div className="flex items-end gap-4">
                                                <div className="w-28 text-lg">Date:</div>
                                                <div className="flex-1 border-b border-blue-400 pb-1 text-slate-900 text-lg">
                                                    {item.date || '-'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center">
                                        <div
                                            className="bg-white p-4 shadow-lg border border-slate-200"
                                            data-sticker-qr={`qr-${idx}`}
                                        >
                                            <QRCodeCanvas value={item.url} size={260} level="H" includeMargin={true} />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handlePrintSingle(item, idx)}
                                            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
                                        >
                                            <Printer className="w-4 h-4" />
                                            Print Sticker
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
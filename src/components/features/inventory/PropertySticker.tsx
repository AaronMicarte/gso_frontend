'use client';

import React, { useCallback, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { QrCode, X, Printer } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

interface PropertyStickerProps {
    propertyNumber: string;
    description?: string;
    department?: string;
    url: string;
    custodianName?: string;
    itemName?: string;
    category?: string;
    date?: string;
    classification?: string;
    acquisitionDate?: string;
    unitCost?: number | string | null;
}

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
    unitCost
}: PropertyStickerProps) {
    const [open, setOpen] = useState(false);

    const resolvedItemName = itemName || description || '-';
    const resolvedCategory = category || classification || '-';
    const resolvedDate = date || acquisitionDate || '-';

    const escapeHtml = (s: string) =>
        s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

    const handlePrint = useCallback(() => {
        // Render the QR code to a canvas off the visible tree, then grab its data URL.
        const qrCanvas = document.createElement('canvas');
        const qrContainer = document.createElement('div');
        qrContainer.style.position = 'fixed';
        qrContainer.style.left = '-9999px';
        document.body.appendChild(qrContainer);

        // Use a temporary React-free render via QRCodeCanvas isn't possible outside React,
        // so instead we read the already-rendered QR canvas from the dialog.
        const existingCanvas = document.querySelector<HTMLCanvasElement>(
            '[data-sticker-qr="true"] canvas'
        );

        let qrDataUrl = '';
        if (existingCanvas) {
            qrDataUrl = existingCanvas.toDataURL('image/png');
        }
        document.body.removeChild(qrContainer);
        void qrCanvas;

        const printWindow = window.open('', 'gso-property-sticker-print');
        if (!printWindow) return;

        const html = `
<!doctype html>
<html>
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Property Sticker</title>
        <style>
            @page { size: A4 landscape; margin: 10mm;}
            * { box-sizing: border-box; }
            html, body { height: 100%; margin: 0; }
            body {
                font-family: Helvetica, Arial, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #fff;
            }
            .sticker {
                 display: grid;
                 grid-template-columns: 1fr 320px;
                 gap: 40px;
                 align-items: start;
                 padding: 40px;
                 max-width: 900px;
                 border: 2px solid #94a3b8;
            }
            .title {
                font-size: 28px;
                font-weight: 800;
                letter-spacing: 0.05em;
                color: #2563eb;
                margin-bottom: 40px;
            }
            .field {
                display: flex;
                align-items: flex-end;
                gap: 16px;
                margin-bottom: 24px;
                color: #2563eb;
                font-size: 18px;
            }
            .field-label {
                width: 112px;
                flex-shrink: 0;
            }
            .field-value {
                flex: 1;
                border-bottom: 1px solid #60a5fa;
                padding-bottom: 4px;
                color: #0f172a;
            }
            .qr-wrap {
                display: flex;
                flex-direction: column;
                align-items: center;
            }
            .qr-box {
                background: #fff;
                padding: 16px;
                box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
                border: 1px solid #e2e8f0;
            }
            .qr-box img {
                width: 260px;
                height: 260px;
                display: block;
            }
        </style>
    </head>
    <body>
        <div class="sticker">
            <div>
                <div class="title">ITEM ${escapeHtml(propertyNumber)}</div>
                <div class="field">
                    <div class="field-label">Name:</div>
                    <div class="field-value">${escapeHtml(custodianName || '-')}</div>
                </div>
                <div class="field">
                    <div class="field-label">Article:</div>
                    <div class="field-value">${escapeHtml(resolvedItemName)}</div>
                </div>
                <div class="field">
                    <div class="field-label">Classification:</div>
                    <div class="field-value">${escapeHtml(resolvedCategory)}</div>
                </div>
                <div class="field">
                    <div class="field-label">PR Number:</div>
                    <div class="field-value">${escapeHtml(propertyNumber)}</div>
                </div>
                <div class="field">
                    <div class="field-label">Date:</div>
                    <div class="field-value">${escapeHtml(resolvedDate)}</div>
                </div>
            </div>
            <div class="qr-wrap">
                <div class="qr-box">
                    ${qrDataUrl
                ? `<img src="${qrDataUrl}" alt="QR Code" />`
                : `<div style="width:260px;height:260px;display:flex;align-items:center;justify-content:center;color:#94a3b8;">QR unavailable</div>`
            }
                </div>
            </div>
        </div>
        <script>
            window.onload = function () {
                window.focus();
                window.print();
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
    }, [propertyNumber, custodianName, resolvedItemName, resolvedCategory, resolvedDate]);

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
                <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-5xl bg-white rounded-xl shadow-2xl z-50 p-0 overflow-hidden outline-none">
                    <Dialog.Title className="sr-only">Property Sticker</Dialog.Title>
                    <Dialog.Close asChild>
                        <button className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </Dialog.Close>

                    <div className="p-10" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-10 items-start">
                            <div>
                                <div className="text-3xl font-extrabold tracking-wide text-blue-600 mb-10">
                                    ITEM {propertyNumber}
                                </div>

                                <div className="space-y-6 text-blue-600">
                                    <div className="flex items-end gap-4">
                                        <div className="w-28 text-lg">Name:</div>
                                        <div className="flex-1 border-b border-blue-400 pb-1 text-slate-900 text-lg">
                                            {custodianName || '-'}
                                        </div>
                                    </div>

                                    <div className="flex items-end gap-4">
                                        <div className="w-28 text-lg">Article:</div>
                                        <div className="flex-1 border-b border-blue-400 pb-1 text-slate-900 text-lg">
                                            {resolvedItemName}
                                        </div>
                                    </div>

                                    <div className="flex items-end gap-4">
                                        <div className="w-28 text-lg">Classification:</div>
                                        <div className="flex-1 border-b border-blue-400 pb-1 text-slate-900 text-lg">
                                            {resolvedCategory}
                                        </div>
                                    </div>

                                    <div className="flex items-end gap-4">
                                        <div className="w-28 text-lg">PR Number:</div>
                                        <div className="flex-1 border-b border-blue-400 pb-1 text-slate-900 text-lg">
                                            {propertyNumber}
                                        </div>
                                    </div>

                                    <div className="flex items-end gap-4">
                                        <div className="w-28 text-lg">Date:</div>
                                        <div className="flex-1 border-b border-blue-400 pb-1 text-slate-900 text-lg">
                                            {resolvedDate}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col items-center">
                                <div
                                    className="bg-white p-4 shadow-lg border border-slate-200"
                                    data-sticker-qr="true"
                                >
                                    <QRCodeCanvas value={url} size={260} level="H" includeMargin={true} />
                                </div>

                                <button
                                    type="button"
                                    onClick={handlePrint}
                                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                                >
                                    <Printer className="w-4 h-4" />
                                    Print Property Sticker
                                </button>
                            </div>
                        </div>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
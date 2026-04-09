'use client';

import React, { useCallback, useRef, useState } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { QrCode, X, Printer } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { toPng } from 'html-to-image';

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
    const viewRef = useRef<HTMLDivElement>(null);
    const printRef = useRef<HTMLDivElement>(null);
    const printButtonRef = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);

    const resolvedItemName = itemName || description || '-';
    const resolvedCategory = category || classification || '-';
    const resolvedDate = date || acquisitionDate || '-';

    const handlePrint = useCallback(async () => {
        const nodeToPrint = printRef.current ?? viewRef.current;
        if (!nodeToPrint || isPrinting) return;

        // Open the print window synchronously (still inside the click gesture).
        // If we wait for async work first, many browsers will show an about:blank window.
        const printWindow = window.open('', 'gso-property-sticker-print');
        if (!printWindow) return;
        try {
            printWindow.focus();
        } catch {
            // ignore
        }

        printWindow.document.open();
        printWindow.document.write(`
<!doctype html>
<html>
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Property Sticker</title>
        <style>
            @page { size: A4; margin: 10mm; }
            html, body { height: 100%; font-family: Helvetica, Arial, sans-serif; }
            body { margin: 0; display: flex; align-items: center; justify-content: center; background: #fff; }
            img { max-width: 100%; height: auto; }
            .loading { font-family: Helvetica, Arial, sans-serif; color: #334155; }
        </style>
    </head>
    <body>
        <div class="loading">Preparing sticker…</div>
    </body>
</html>`);
        printWindow.document.close();

        try {
            setIsPrinting(true);

            const printButtonEl = printButtonRef.current;
            const previousVisibility = printButtonEl?.style.visibility;
            if (printButtonEl) printButtonEl.style.visibility = 'hidden';

            // Ensure fonts/layout are fully settled before snapshotting.
            if (document.fonts?.ready) {
                await document.fonts.ready;
            }
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

            const rect = nodeToPrint.getBoundingClientRect();
            const width = Math.max(1, Math.ceil(rect.width || nodeToPrint.scrollWidth));
            const height = Math.max(1, Math.ceil(rect.height || nodeToPrint.scrollHeight));

            const dataUrl = await toPng(nodeToPrint, {
                cacheBust: true,
                pixelRatio: 2,
                backgroundColor: '#ffffff',
                width,
                height,
            });

            if (printButtonEl) printButtonEl.style.visibility = previousVisibility ?? '';

            // Replace the loading content with the final image, then print after it loads.
            if (printWindow.closed) return;

            printWindow.document.open();
            printWindow.document.write(`
<!doctype html>
<html>
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Property Sticker</title>
        <style>
            @page { size: A4; margin: 10mm; }
            html, body { height: 100%; }
            body { margin: 0; display: flex; align-items: center; justify-content: center; background: #fff; }
            img { max-width: 100%; height: auto; }
        </style>
    </head>
    <body>
        <img id="sticker" alt="Property Sticker" />
    </body>
</html>`);
            printWindow.document.close();

            const img = printWindow.document.getElementById('sticker') as HTMLImageElement | null;
            if (!img) return;

            img.onload = () => {
                try {
                    printWindow.onafterprint = () => {
                        try {
                            printWindow.close();
                        } catch {
                            // ignore
                        }
                    };

                    printWindow.focus();
                    printWindow.print();
                } catch {
                    // ignore
                }
            };
            img.onerror = () => {
                try {
                    const body = printWindow.document.body;
                    body.innerHTML = '<div style="font-family:Arial,Helvetica,sans-serif;color:#b91c1c;padding:16px;">Failed to render sticker image for printing.</div>';
                } catch {
                    // ignore
                }
            };
            img.src = dataUrl;
        } finally {
            const printButtonEl = printButtonRef.current;
            if (printButtonEl) printButtonEl.style.visibility = '';
            setIsPrinting(false);
        }
    }, [isPrinting]);

    const StickerContent = useCallback(
        ({ showPrintButton }: { showPrintButton: boolean }) => (
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
                        <div className="bg-white p-4 shadow-lg border border-slate-200">
                            {showPrintButton ? (
                                <QRCodeCanvas value={url} size={260} level="H" includeMargin={true} />
                            ) : (
                                <QRCodeSVG value={url} width={260} height={260} level="H" includeMargin={true} />
                            )}
                        </div>

                        {showPrintButton ? (
                            <button
                                ref={printButtonRef}
                                type="button"
                                onClick={handlePrint}
                                disabled={isPrinting}
                                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                            >
                                <Printer className="w-4 h-4" />
                                Print Property Sticker
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>
        ),
        [
            custodianName,
            handlePrint,
            isPrinting,
            propertyNumber,
            resolvedCategory,
            resolvedDate,
            resolvedItemName,
            url,
        ]
    );

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

                    <div ref={viewRef}>{StickerContent({ showPrintButton: true })}</div>
                </Dialog.Content>
            </Dialog.Portal>

            {/* Offscreen render for reliable screenshot-to-print */}
            <div
                aria-hidden="true"
                style={{ position: 'fixed', left: 0, top: 0, opacity: 0, pointerEvents: 'none' }}
            >
                <div ref={printRef} className="max-w-5xl bg-white">
                    {StickerContent({ showPrintButton: false })}
                </div>
            </div>
        </Dialog.Root>
    );
}

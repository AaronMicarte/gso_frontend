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
    serialNumber?: string;
    modelNumber?: string;
    brand?: string;
    url: string;
    endUserName?: string | null;
    currentDepartmentHead?: string | null;
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
    serialNumber?: string;
    modelNumber?: string;
    brand?: string;
    endUserName?: string | null;
    currentDepartmentHead?: string | null;
    items?: PropertyStickerItem[];
}

const formatDate = (dateStr?: string | null): string => {
    if (!dateStr || dateStr === '-' || dateStr === 'N/A') return '-';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    } catch {
        return dateStr;
    }
};

const getPropertyDescription = (itemName?: string, brand?: string) => {
    const item = (itemName || '').trim();
    const b = (brand || '').trim();
    if (!item || item === '-') {
        return b && b !== '-' ? `(${b})` : '-';
    }
    if (b && b !== '-') {
        return `${item} (${b})`;
    }
    return item;
};

const getAccountablePerson = (item: PropertyStickerItem) => {
    if (item.endUserName && item.endUserName.trim() !== '') {
        return item.endUserName;
    }
    const requester = (item.custodianName || '').trim();
    if (requester && requester !== 'Unassigned' && requester !== 'Requester not set' && requester !== '-') {
        return requester;
    }
    if (item.currentDepartmentHead && item.currentDepartmentHead.trim() !== '') {
        return item.currentDepartmentHead;
    }
    return 'UNASSIGNED';
};

const escapeHtml = (s?: string | null) => {
    if (!s) return '';
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

const formatCost = (v?: number | string | null) => {
    if (v === null || v === undefined || v === '') return '-';
    const n = typeof v === 'string' ? parseFloat(v) : v;
    if (isNaN(n)) return String(v);
    return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const LOGO_SRC = '/assets/images/background/propertysticker.png';

const imgToDataUrl = (src: string): Promise<string> =>
    new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const c = document.createElement('canvas');
            c.width = img.naturalWidth || 80;
            c.height = img.naturalHeight || 80;
            c.getContext('2d')!.drawImage(img, 0, 0);
            try { resolve(c.toDataURL('image/png')); } catch { resolve(''); }
        };
        img.onerror = () => resolve('');
        img.src = src;
    });

// ── Print HTML ────────────────────────────────────────────────────────────────
const buildPrintHtml = (
    itemsToPrint: PropertyStickerItem[],
    qrDataUrls: string[],
    logoDataUrl: string,
): string => {
    // 8 stickers per A4 page (2 columns × 4 rows)
    const STICKERS_PER_PAGE = 8;
    const pages: { item: PropertyStickerItem; qr: string }[][] = [];
    const pairs = itemsToPrint.map((item, i) => ({ item, qr: qrDataUrls[i] || '' }));
    for (let i = 0; i < pairs.length; i += STICKERS_PER_PAGE) {
        pages.push(pairs.slice(i, i + STICKERS_PER_PAGE));
    }

    const logoTag = logoDataUrl ? `<img class="logo" src="${logoDataUrl}" alt="seal" />` : '';

    const stickerHtml = ({ item, qr }: { item: PropertyStickerItem; qr: string }) => `
<div class="sticker">
  <div class="header">
    ${logoTag}
    <div class="header-text">
      <div class="city-name">CITY OF EL SALVADOR CITY</div>
      <div class="office-name">PROPERTY AND SUPPLY MANAGEMENT OFFICE</div>
    </div>
  </div>
  <div class="divider"></div>
  <div class="body">
    <div class="left">
      <div class="pn-label">PROPERTY NUMBER</div>
      <div class="pn-value">${escapeHtml(item.propertyNumber)}</div>
      <div class="fields">
        <div class="field"><span class="fl">DESCRIPTION OF THE PROPERTY: </span><span class="fv">${escapeHtml(getPropertyDescription(item.itemName, item.brand).toUpperCase())}</span></div>
        <div class="field"><span class="fl">MODEL NUMBER: </span><span class="fv">${escapeHtml((item.modelNumber || '-').toUpperCase())}</span></div>
        <div class="field"><span class="fl">SERIAL NUMBER: </span><span class="fv">${escapeHtml((item.serialNumber || '-').toUpperCase())}</span></div>
        <div class="field"><span class="fl">ACQUISITION DATE: </span><span class="fv">${escapeHtml(formatDate(item.date).toUpperCase())}</span></div>
        <div class="field"><span class="fl">ACQUISITION COST: </span><span class="fv">&#8369;${escapeHtml(formatCost(item.unitCost))}</span></div>
        <div class="field acct"><span class="fl">ACCOUNTABLE PERSON: </span><span class="fv fv-name">${escapeHtml(getAccountablePerson(item).toUpperCase())}</span></div>
      </div>
    </div>
    <div class="right">
      ${qr ? `<img class="qr-img" src="${qr}" alt="QR" />` : '<div class="qr-img"></div>'}
      <div class="scan-label">SCAN TO VIEW<br/>PROPERTY DETAILS</div>
    </div>
  </div>
  <div class="divider"></div>
  <div class="footer">
    <div class="sig-wrap">
      <div class="sig-line"></div>
      <div class="sig-label">INVENTORY COMMITTEE REPRESENTATIVE</div>
    </div>
    <div class="note-bold">NOTE - PLEASE DO NOT REMOVE</div>
    <div class="note-fine">Unauthorized removal or tampering will be subject to disciplinary action</div>
  </div>
</div>`;

    const pagesHtml = pages
        .map((pageItems) => `<div class="page">${pageItems.map(stickerHtml).join('')}</div>`)
        .join('');

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>Property Stickers</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #fff; font-family: Arial, Helvetica, sans-serif; color: #000; text-transform: uppercase; width: 297mm; height: 210mm; }

  /* 2 columns × 4 rows = 8 stickers per A4 page */
  .page {
    width: 297mm;
    height: 210mm;
    display: grid;
    grid-template-columns: repeat(2, 76.2mm);
    grid-template-rows: repeat(4, 50.8mm);
    gap: 1.5mm;
    justify-content: center;
    align-content: center;
    page-break-after: always;
    break-after: page;
  }
  .page:last-child { page-break-after: avoid; break-after: avoid; }

  /* 3 × 2 inches = 76.2mm × 50.8mm */
  .sticker {
    width: 76.2mm;
    height: 50.8mm;
    border: 0.8px solid #000;
    padding: 1mm 1.5mm;
    display: flex;
    flex-direction: column;
    gap: 0.5mm;
    page-break-inside: avoid;
    break-inside: avoid;
    overflow: hidden;
    text-transform: uppercase;
  }

  .header { display: flex; align-items: center; gap: 2px; }
  .logo { width: 10px; height: 10px; object-fit: contain; flex-shrink: 0; }
  .header-text { display: flex; flex-direction: column; }
  .city-name { font-size: 4px; font-weight: 900; letter-spacing: 0.01em; line-height: 1.1; }
  .office-name { font-size: 3px; font-weight: 700; letter-spacing: 0.02em; line-height: 1.1; }

  .divider { border-top: 0.4px solid #000; width: 100%; flex-shrink: 0; }

  .body { display: flex; align-items: flex-start; gap: 1.5mm; flex: 1; overflow: hidden; }
  .left { flex: 1; display: flex; flex-direction: column; gap: 0.3mm; overflow: hidden; }
  .right { display: flex; flex-direction: column; align-items: center; gap: 0.5px; flex-shrink: 0; }

  .pn-label { font-size: 3.5px; font-weight: 900; letter-spacing: 0.04em; }
  .pn-value { font-size: 5.5px; font-weight: 900; letter-spacing: 0.01em; line-height: 1.1; }

  .fields { display: flex; flex-direction: column; gap: 0.3mm; }
  .field { font-size: 3.8px; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 44mm; }
  .fl { font-weight: 900; }
  .fv { font-weight: 700; }
  .acct .fv-name { font-weight: 900; font-size: 4.2px; }

  /* QR: ~1 inch = 22mm */
  .qr-img { width: 22mm; height: 22mm; object-fit: contain; border: 0.4px solid #000; padding: 0.5px; display: block; }
  .scan-label { font-size: 2.8px; font-weight: 800; letter-spacing: 0.02em; text-align: center; line-height: 1.1; margin-top: 1px; }

  .footer { display: flex; flex-direction: column; align-items: center; gap: 0.5px; }
  .sig-wrap { display: flex; flex-direction: column; align-items: center; gap: 0.5px; margin-top: 0.5px; margin-bottom: 0.5px; }
  .sig-line { width: 30mm; border-top: 0.4px solid #000; }
  .sig-label { font-size: 2.8px; letter-spacing: 0.02em; }
  .note-bold { font-size: 3.8px; font-weight: 900; letter-spacing: 0.02em; }
  .note-fine { font-size: 2.8px; font-style: italic; }
</style>
</head>
<body>
  ${pagesHtml}
  <script>
    window.onload = function () { window.focus(); setTimeout(function () { window.print(); }, 300); };
    window.onafterprint = function () { window.close(); };
  </script>
</body>
</html>`;
};


// ── Preview ───────────────────────────────────────────────────────────────────
function StickerPreview({
    item,
    idx,
    onPrint,
}: {
    item: PropertyStickerItem;
    idx: number;
    onPrint: (item: PropertyStickerItem, idx: number) => void;
}) {
    return (
        <div className="flex flex-col items-center gap-2">
            {/* Sticker card — 3×2 inch at 96 dpi = 288×192 px */}
            <div
                className="border border-black bg-white uppercase overflow-hidden flex flex-col"
                style={{
                    width: 288,
                    height: 192,
                    padding: '4px 6px',
                    gap: 2,
                    fontFamily: 'Arial, Helvetica, sans-serif',
                }}
            >
                {/* Header */}
                <div className="flex items-center" style={{ gap: 4, flexShrink: 0 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={LOGO_SRC} alt="seal" style={{ width: 14, height: 14, objectFit: 'contain', flexShrink: 0 }} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: 4.5, fontWeight: 900, letterSpacing: '0.01em', lineHeight: 1.1 }}>
                            CITY OF EL SALVADOR CITY
                        </div>
                        <div style={{ fontSize: 3.5, fontWeight: 700, letterSpacing: '0.02em', lineHeight: 1.1 }}>
                            PROPERTY AND SUPPLY MANAGEMENT OFFICE
                        </div>
                    </div>
                </div>

                <div className="border-t border-black" style={{ flexShrink: 0 }} />

                {/* Body */}
                <div className="flex items-start" style={{ gap: 6, flex: 1, overflow: 'hidden' }}>
                    {/* Left */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, overflow: 'hidden' }}>
                        <div style={{ fontSize: 3.5, fontWeight: 900, letterSpacing: '0.04em', lineHeight: 1 }}>PROPERTY NUMBER</div>
                        <div style={{ fontSize: 6.5, fontWeight: 900, lineHeight: 1.1, letterSpacing: '0.01em', marginBottom: 1 }}>
                            {item.propertyNumber}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {[
                                ['DESCRIPTION OF THE PROPERTY', getPropertyDescription(item.itemName, item.brand).toUpperCase()],
                                ['MODEL NUMBER', (item.modelNumber || '-').toUpperCase()],
                                ['SERIAL NUMBER', (item.serialNumber || '-').toUpperCase()],
                                ['ACQUISITION DATE', formatDate(item.date).toUpperCase()],
                                ['ACQUISITION COST', `₱${formatCost(item.unitCost)}`],
                                ['ACCOUNTABLE PERSON', getAccountablePerson(item).toUpperCase()],
                            ].map(([label, value]) => (
                                <div key={label} style={{ fontSize: 3.8, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: 166 }}>
                                    <span style={{ fontWeight: 900 }}>{label}: </span>
                                    <span style={{ fontWeight: label === 'ACCOUNTABLE PERSON' ? 900 : 700, fontSize: label === 'ACCOUNTABLE PERSON' ? 4.2 : undefined }}>{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right — QR (~1 inch = 96px) */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                        <div id={`sticker-qr-${idx}`} style={{ border: '0.5px solid black', padding: 1 }}>
                            <QRCodeCanvas
                                value={item.url || 'https://iams-gso.gov.ph'}
                                size={83}
                                level="H"
                                includeMargin={false}
                            />
                        </div>
                        <div style={{ fontSize: 3, fontWeight: 800, letterSpacing: '0.02em', textAlign: 'center', lineHeight: 1.1 }}>
                            SCAN TO VIEW<br />PROPERTY DETAILS
                        </div>
                    </div>
                </div>

                <div className="border-t border-black" style={{ flexShrink: 0 }} />

                {/* Footer */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, marginTop: 1, marginBottom: 1 }}>
                        <div style={{ width: 115, borderTop: '0.4px solid black' }} />
                        <div style={{ fontSize: 2.8, letterSpacing: '0.02em' }}>INVENTORY COMMITTEE REPRESENTATIVE</div>
                    </div>
                    <div style={{ fontSize: 3.8, fontWeight: 900, letterSpacing: '0.02em' }}>NOTE - PLEASE DO NOT REMOVE</div>
                    <div style={{ fontSize: 2.8, fontStyle: 'italic' }}>Unauthorized removal or tampering will be subject to disciplinary action</div>
                </div>
            </div>

            {/* Print button — outside sticker card */}
            <button
                type="button"
                onClick={() => onPrint(item, idx)}
                className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 text-slate-700 rounded text-xs hover:bg-slate-100 transition-colors"
            >
                <Printer className="w-3 h-3" />
                Print Sticker
            </button>
        </div>
    );
}


// ── Main ──────────────────────────────────────────────────────────────────────
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
    serialNumber,
    modelNumber,
    brand,
    endUserName,
    currentDepartmentHead,
    items,
}: PropertyStickerProps) {
    const [open, setOpen] = useState(false);

    const resolvedItems = useMemo<PropertyStickerItem[]>(() => {
        if (items && items.length > 0) return items;
        return [
            {
                propertyNumber: propertyNumber || '',
                custodianName: custodianName || 'Unassigned',
                itemName: itemName || description || '-',
                category: category || classification || '-',
                date: date || acquisitionDate || '-',
                unitCost,
                serialNumber: serialNumber || '',
                modelNumber: modelNumber || '',
                brand: brand || '',
                url: url || '',
                endUserName: endUserName || '',
                currentDepartmentHead: currentDepartmentHead || '',
            },
        ];
    }, [
        items, propertyNumber, custodianName, itemName, description, category,
        classification, date, acquisitionDate, unitCost, serialNumber, modelNumber, brand, url,
        endUserName, currentDepartmentHead
    ]);

    const handlePrintItems = useCallback(
        async (itemsToPrint: PropertyStickerItem[], startIdx: number) => {
            const qrDataUrls = itemsToPrint.map((_, i) => {
                const container = document.getElementById(`sticker-qr-${startIdx + i}`);
                const canvas = container?.querySelector<HTMLCanvasElement>('canvas');
                return canvas ? canvas.toDataURL('image/png') : '';
            });

            const logoDataUrl = await imgToDataUrl(window.location.origin + LOGO_SRC);

            const win = window.open('', 'gso-property-sticker-print');
            if (!win) return;
            win.document.open();
            win.document.write(buildPrintHtml(itemsToPrint, qrDataUrls, logoDataUrl));
            win.document.close();
        },
        [],
    );

    const handlePrintAll = useCallback(
        () => handlePrintItems(resolvedItems, 0),
        [resolvedItems, handlePrintItems],
    );

    const handlePrintSingle = useCallback(
        (item: PropertyStickerItem, idx: number) => handlePrintItems([item], idx),
        [handlePrintItems],
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
                <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl bg-white rounded-xl shadow-2xl z-50 p-0 overflow-hidden outline-none flex flex-col max-h-[90vh]">
                    <Dialog.Title className="sr-only">Property Sticker</Dialog.Title>

                    <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-slate-50">
                        <h3 className="text-base font-semibold text-slate-900">
                            {resolvedItems.length > 1
                                ? `Property Stickers (${resolvedItems.length})`
                                : 'Property Sticker'}
                        </h3>
                        <button
                            type="button"
                            onClick={handlePrintAll}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            <Printer className="w-4 h-4" />
                            {resolvedItems.length > 1 ? 'Print All' : 'Print Sticker'}
                        </button>
                    </div>

                    <Dialog.Close asChild>
                        <button className="absolute right-4 top-3 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors z-20">
                            <X className="w-5 h-5" />
                        </button>
                    </Dialog.Close>

                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="grid grid-cols-2 gap-6 justify-items-center">
                            {resolvedItems.map((item, idx) => (
                                <StickerPreview
                                    key={idx}
                                    item={item}
                                    idx={idx}
                                    onPrint={handlePrintSingle}
                                />
                            ))}
                        </div>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
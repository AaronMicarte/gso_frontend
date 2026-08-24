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
        return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } catch { return dateStr; }
};

const getPropertyDescription = (itemName?: string, brand?: string) => {
    const item = (itemName || '').trim();
    const b = (brand || '').trim();
    if (!item || item === '-') return b && b !== '-' ? `(${b})` : '-';
    return b && b !== '-' ? `${item} (${b})` : item;
};

const getAccountablePerson = (item: PropertyStickerItem) => {
    if (item.endUserName && item.endUserName.trim() !== '') return item.endUserName;
    const requester = (item.custodianName || '').trim();
    if (requester && requester !== 'Unassigned' && requester !== 'Requester not set' && requester !== '-') return requester;
    if (item.currentDepartmentHead && item.currentDepartmentHead.trim() !== '') return item.currentDepartmentHead;
    return 'UNASSIGNED';
};

const escapeHtml = (s?: string | null) => {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
    const STICKERS_PER_PAGE = 12;
    const pages: { item: PropertyStickerItem; qr: string }[][] = [];
    const pairs = itemsToPrint.map((item, i) => ({ item, qr: qrDataUrls[i] || '' }));
    for (let i = 0; i < pairs.length; i += STICKERS_PER_PAGE) {
        pages.push(pairs.slice(i, i + STICKERS_PER_PAGE));
    }

    const logoTag = logoDataUrl
        ? `<img class="logo" src="${logoDataUrl}" alt="seal" />`
        : '';

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
      <div class="pn-section">
        <div class="pn-label">PROPERTY NUMBER</div>
        <div class="pn-value">${escapeHtml(item.propertyNumber)}</div>
      </div>
      <div class="divider" style="margin:0.7mm 0;"></div>
      <div class="fields">
        <div class="field"><span class="fl">DESCRIPTION: </span><span class="fv">${escapeHtml(getPropertyDescription(item.itemName, item.brand).toUpperCase())}</span></div>
        <div class="field"><span class="fl">MODEL NUMBER: </span><span class="fv">${escapeHtml((item.modelNumber || '-').toUpperCase())}</span></div>
        <div class="field"><span class="fl">SERIAL NUMBER: </span><span class="fv">${escapeHtml((item.serialNumber || '-').toUpperCase())}</span></div>
        <div class="field"><span class="fl">ACQUISITION DATE: </span><span class="fv">${escapeHtml(formatDate(item.date).toUpperCase())}</span></div>
        <div class="field"><span class="fl">ACQUISITION COST: </span><span class="fv">${escapeHtml(formatCost(item.unitCost))}</span></div>
        <div class="field acct"><span class="fl">ACCOUNTABLE PERSON: </span><span class="fv fv-name">${escapeHtml(getAccountablePerson(item).toUpperCase())}</span></div>
      </div>
    </div>
    <div class="vert-divider"></div>
    <div class="right">
      ${qr ? `<div class="qr-wrap"><img class="qr-img" src="${qr}" alt="QR" /></div>` : '<div class="qr-wrap qr-empty"></div>'}
    </div>
  </div>
  <div class="divider"></div>
  <div class="footer">
    <div class="sig-line"></div>
    <div class="sig-label">INVENTORY COMMITTEE REPRESENTATIVE</div>
    <div class="note-bold">NOTE - PLEASE DO NOT REMOVE</div>
    <div class="note-fine">Unauthorized removal or tampering will be subject to disciplinary action</div>
  </div>
</div>`;

    const pagesHtml = pages
        .map(pg => `<div class="page">${pg.map(stickerHtml).join('')}</div>`)
        .join('');

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>Property Stickers</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    background: #fff;
    font-family: Arial, Helvetica, sans-serif;
    color: #000;
    width: 297mm;
    height: 210mm;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: 297mm;
    height: 210mm;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(4, 1fr);
    gap: 0.8mm;
    padding: 1mm;
    page-break-after: always;
    break-after: page;
  }
  .page:last-child { page-break-after: avoid; break-after: avoid; }
  .sticker {
    background: #fff;
    color: #000;
    border: 0.6px solid #000;
    padding: 1mm 1.2mm 0.7mm;
    display: flex;
    flex-direction: column;
    page-break-inside: avoid;
    break-inside: avoid;
    overflow: hidden;
    text-transform: uppercase;
    min-width: 0;
    min-height: 0;
  }
  .header {
    display: flex;
    align-items: center;
    gap: 1.2mm;
    flex-shrink: 0;
    padding-bottom: 0.6mm;
  }
  .logo { width: 8mm; height: 8mm; object-fit: contain; flex-shrink: 0; }
  .city-name   { font-size: 6px; font-weight: 900; letter-spacing: 0.02em; line-height: 1.15; }
  .office-name { font-size: 3.5px; font-weight: 700; letter-spacing: 0.04em; line-height: 1.15; }
  .divider { border-top: 0.5px solid #000; width: 100%; flex-shrink: 0; }
  .body {
    display: flex;
    align-items: stretch;
    flex: 1;
    min-height: 0;
    padding: 0.7mm 0;
  }
  .left {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding-right: 1.2mm;
  }
  .pn-section  { text-align: center; flex-shrink: 0; margin-bottom: 0; }
  .pn-label    { font-size: 4.5px; font-weight: 900; letter-spacing: 0.08em; line-height: 1.2; }
  .pn-value    { font-size: 7px;   font-weight: 900; letter-spacing: 0.02em; line-height: 1.2; }
  .fields {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-evenly;
  }
  .field {
    font-size: 4.5px;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .fl { font-weight: 900; }
  .fv { font-weight: 900; }
  .acct .fv-name { font-weight: 900; font-size: 5px; }
  .vert-divider { width: 0.5px; background: #000; flex-shrink: 0; align-self: stretch; }
  .right {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding-left: 1.2mm;
    flex-shrink: 0;
    width: 24mm;
  }
  .qr-wrap  { border: 0.5px solid #000; padding: 0.5mm; display: inline-block; }
  .qr-img   { width: 22mm; height: 22mm; display: block; object-fit: contain; }
  .qr-empty { width: 22mm; height: 22mm; }
  .footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3mm;
    flex-shrink: 0;
    padding-top: 0.5mm;
  }
  .sig-line  { width: 25mm; border-top: 0.4px solid #000; margin-bottom: 0.3mm; }
  .sig-label { font-size: 2.8px; letter-spacing: 0.04em; }
  .note-bold { font-size: 4.5px; font-weight: 900; letter-spacing: 0.03em; }
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
    large = false,
}: {
    item: PropertyStickerItem;
    idx: number;
    onPrint: (item: PropertyStickerItem, idx: number) => void;
    large?: boolean;
}) {
    const fields: [string, string][] = [
        ['DESCRIPTION', getPropertyDescription(item.itemName, item.brand).toUpperCase()],
        ['MODEL NUMBER', (item.modelNumber || '-').toUpperCase()],
        ['SERIAL NUMBER', (item.serialNumber || '-').toUpperCase()],
        ['ACQUISITION DATE', formatDate(item.date).toUpperCase()],
        ['ACQUISITION COST', `${formatCost(item.unitCost)}`],
        ['ACCOUNTABLE PERSON', getAccountablePerson(item).toUpperCase()],
    ];

    const S = {
        root: {
            width: 288,
            height: 192,
            background: '#fff',
            color: '#000',
            border: '1px solid #000',
            fontFamily: 'Arial, Helvetica, sans-serif',
            display: 'flex' as const,
            flexDirection: 'column' as const,
            padding: '4px 5px 3px',
            gap: 0,
            textTransform: 'uppercase' as const,
            overflow: 'hidden',
        },
        header: {
            display: 'flex' as const,
            alignItems: 'center' as const,
            gap: 6,
            flexShrink: 0,
            paddingBottom: 3,
        },
        divider: { borderTop: '0.7px solid #000', width: '100%', flexShrink: 0 },
        body: { display: 'flex' as const, alignItems: 'stretch' as const, flex: 1, overflow: 'hidden', padding: '2px 0' },
        left: { flex: 1, display: 'flex' as const, flexDirection: 'column' as const, overflow: 'hidden', paddingRight: 4 },
        right: { width: 75, display: 'flex' as const, flexDirection: 'column' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 2, paddingLeft: 4, flexShrink: 0 },
        footer: { display: 'flex' as const, flexDirection: 'column' as const, alignItems: 'center' as const, gap: 1, flexShrink: 0, paddingTop: 2 },
    };

    const sticker = (
        <div style={S.root}>
            {/* Header */}
            <div style={S.header}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={LOGO_SRC} alt="seal" style={{ width: 30, height: 30, objectFit: 'contain', flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 900, color: '#000', letterSpacing: '0.02em', lineHeight: 1.1 }}>
                        CITY OF EL SALVADOR CITY
                    </div>
                    <div style={{ fontSize: 6, fontWeight: 700, color: '#000', letterSpacing: '0.04em', lineHeight: 1.1 }}>
                        PROPERTY AND SUPPLY MANAGEMENT OFFICE
                    </div>
                </div>
            </div>

            <div style={S.divider} />

            {/* Body */}
            <div style={S.body}>
                {/* Left */}
                <div style={S.left}>
                    <div style={{ fontSize: 7, fontWeight: 900, textAlign: 'center', letterSpacing: '0.08em', lineHeight: 1, marginBottom: 1 }}>
                        PROPERTY NUMBER
                    </div>
                    <div style={{ fontSize: 9, fontWeight: 900, textAlign: 'center', letterSpacing: '0.02em', lineHeight: 1.1, marginBottom: 2 }}>
                        {item.propertyNumber}
                    </div>
                    <div style={{ borderTop: '0.7px solid #000', marginBottom: 3, flexShrink: 0 }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {fields.map(([label, value]) => (
                            <div key={label} style={{ fontSize: 6.2, lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: 170 }}>
                                <span style={{ fontWeight: 900, fontSize: label === 'ACCOUNTABLE PERSON' ? 6.8 : undefined }}>
                                    {value}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Vertical divider */}
                <div style={{ width: 1, background: '#000', flexShrink: 0, alignSelf: 'stretch' }} />

                {/* Right — QR */}
                <div style={S.right}>
                    <div id={`sticker-qr-${idx}`} style={{ border: '1px solid #000', padding: 2, background: '#fff', display: 'inline-block' }}>
                        <QRCodeCanvas
                            value={item.url || 'https://iams-gso.gov.ph'}
                            size={72}
                            level="M"
                            includeMargin={false}
                            bgColor="#ffffff"
                            fgColor="#000000"
                        />
                    </div>
                </div>
            </div>

            <div style={S.divider} />

            {/* Footer */}
            <div style={S.footer}>
                <div style={{ width: 110, borderTop: '0.7px solid #000', marginBottom: 1 }} />
                <div style={{ fontSize: 5, letterSpacing: '0.04em' }}>INVENTORY COMMITTEE REPRESENTATIVE</div>
                <div style={{ fontSize: 7, fontWeight: 900, letterSpacing: '0.04em' }}>NOTE - PLEASE DO NOT REMOVE</div>
                <div style={{ fontSize: 4.5, fontStyle: 'italic' }}>Unauthorized removal or tampering will be subject to disciplinary action</div>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col items-center gap-4">
            {large ? (
                // Single item — scale up and compensate layout space
                <div style={{ position: 'relative', width: 288 * 1.6, height: 192 * 1.6 }}>
                    <div style={{
                        transform: 'scale(1.6)',
                        transformOrigin: 'top left',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                    }}>
                        {sticker}
                    </div>
                </div>
            ) : sticker}

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
        return [{
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
        }];
    }, [
        items, propertyNumber, custodianName, itemName, description, category,
        classification, date, acquisitionDate, unitCost, serialNumber, modelNumber, brand, url,
        endUserName, currentDepartmentHead,
    ]);

    const isSingle = resolvedItems.length === 1;

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

    const handlePrintAll = useCallback(() => handlePrintItems(resolvedItems, 0), [resolvedItems, handlePrintItems]);
    const handlePrintSingle = useCallback((item: PropertyStickerItem, idx: number) => handlePrintItems([item], idx), [handlePrintItems]);

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
                            {isSingle ? 'Property Sticker' : `Property Stickers (${resolvedItems.length})`}
                        </h3>
                        <button
                            type="button"
                            onClick={handlePrintAll}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            <Printer className="w-4 h-4" />
                            {isSingle ? 'Print Sticker' : 'Print All'}
                        </button>
                    </div>

                    <Dialog.Close asChild>
                        <button className="absolute right-4 top-3 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors z-20">
                            <X className="w-5 h-5" />
                        </button>
                    </Dialog.Close>

                    <div className="flex-1 overflow-y-auto p-6">
                        <div className={`grid gap-6 justify-items-center ${isSingle ? 'grid-cols-1' : 'grid-cols-2'}`}>
                            {resolvedItems.map((item, idx) => (
                                <StickerPreview
                                    key={idx}
                                    item={item}
                                    idx={idx}
                                    onPrint={handlePrintSingle}
                                    large={isSingle}
                                />
                            ))}
                        </div>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
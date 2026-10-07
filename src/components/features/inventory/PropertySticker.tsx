'use client';

import React, { useCallback, useState, useMemo } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { QrCode, X, Printer } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

export interface PropertyStickerItem {
    propertyNumber: string;   // physical property tag (PROPERTY NO:)
    parIcsNumber?: string;    // issuance document number (PAR NO: / ICS NO:)
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
    documentType?: string;
    office?: string;
}

interface PropertyStickerProps {
    propertyNumber?: string;
    parIcsNumber?: string;
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
    documentType?: string;
    office?: string;
    items?: PropertyStickerItem[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatDate = (dateStr?: string | null): string => {
    if (!dateStr || dateStr === '-' || dateStr === 'N/A') return '-';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } catch { return dateStr; }
};

const getBrandModel = (brand?: string, model?: string) => {
    const b = (brand || '').trim();
    const m = (model || '').trim();
    if (!b && !m) return '-';
    return [b, m].filter(Boolean).join(' / ');
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

const LOGO_LEFT_SRC = '/assets/images/background/propertysticker.png';
const LOGO_RIGHT_SRC = '/assets/images/background/propertysticker.png';

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

// ── Per–document-type copy (PAR / ICS reference stickers) ─────────────────────
type DocType = 'PAR' | 'ICS' | 'OTHER';

const normalizeDocType = (v?: string | null, parIcsNo?: string | null): DocType => {
    const t = (v || '').trim().toUpperCase();
    if (t === 'PAR') return 'PAR';
    if (t === 'ICS') return 'ICS';
    const no = (parIcsNo || '').trim().toUpperCase();
    if (no.startsWith('PAR')) return 'PAR';
    if (no.startsWith('ICS')) return 'ICS';
    return 'OTHER';
};

const getDocCopy = (docType: DocType) => {
    switch (docType) {
        case 'PAR':
            return {
                docNoLabel: 'PAR NO:',
                showSignature: true,
                showFinePrint: true,
                footerFine: 'Unauthorized removal or tampering will be subject to disciplinary action',
            };
        case 'ICS':
            return {
                docNoLabel: 'ICS NO:',
                showSignature: false,
                showFinePrint: false,
                footerFine: '',
            };
        default:
            return {
                docNoLabel: 'PAR NO:',
                showSignature: true,
                showFinePrint: true,
                footerFine: 'Unauthorized removal or tampering will be subject to disciplinary action',
            };
    }
};

const getFields = (item: PropertyStickerItem): [string, string][] => {
    const copy = getDocCopy(normalizeDocType(item.documentType, item.parIcsNumber));
    // parIcsNumber = issuance document number (PAR-2026-XXXX / ICS-2026-XXXX)
    // propertyNumber = physical property tag stamped on the asset
    const docNumber = (item.parIcsNumber || '-').toUpperCase();
    const propNumber = (item.propertyNumber || '-').toUpperCase();
    return [
        [copy.docNoLabel, docNumber],
        ['PROPERTY NO:', propNumber],
        ['ARTICLE:', (item.itemName || '-').toUpperCase()],
        ['BRAND/MODEL:', getBrandModel(item.brand, item.modelNumber).toUpperCase()],
        ['SERIAL NO:', (item.serialNumber || '-').toUpperCase()],
        ['ACQUISITION DATE:', formatDate(item.date).toUpperCase()],
        ['ACQUISITION COST:', formatCost(item.unitCost)],
        ['OFFICE:', (item.office || item.category || '-').toUpperCase()],
        ['ACCOUNTABLE PERSON:', getAccountablePerson(item).toUpperCase()],
    ];
};

// ── Print HTML ────────────────────────────────────────────────────────────────
const buildPrintHtml = (
    itemsToPrint: PropertyStickerItem[],
    qrDataUrls: string[],
    logoLeftDataUrl: string,
    logoRightDataUrl: string,
): string => {
    const STICKERS_PER_PAGE = 12;
    const pages: { item: PropertyStickerItem; qr: string }[][] = [];
    const pairs = itemsToPrint.map((item, i) => ({ item, qr: qrDataUrls[i] || '' }));
    for (let i = 0; i < pairs.length; i += STICKERS_PER_PAGE) {
        pages.push(pairs.slice(i, i + STICKERS_PER_PAGE));
    }

    const logoLeftTag = logoLeftDataUrl
        ? `<img class="logo" src="${logoLeftDataUrl}" alt="seal" />`
        : '';
    const logoRightTag = logoRightDataUrl
        ? `<img class="logo" src="${logoRightDataUrl}" alt="seal" />`
        : '';

    const stickerHtml = ({ item, qr }: { item: PropertyStickerItem; qr: string }) => {
        const docType = normalizeDocType(item.documentType);
        const copy = getDocCopy(docType);
        const fields = getFields(item);
        return `
<div class="sticker">
  <div class="header">
    ${logoLeftTag}
    <div class="header-text">
      <div class="lgu-name">LOCAL GOVERNMENT UNIT</div>
      <div class="city-name">EL SALVADOR CITY</div>
    </div>
    ${logoRightTag}
  </div>
  <div class="divider"></div>
  <div class="body">
    <div class="left">
      ${fields.map(([label, value]) => `
      <div class="field">
        <span class="fl">${escapeHtml(label)}</span>
        <span class="fv">${escapeHtml(value)}</span>
      </div>`).join('')}
    </div>
    <div class="vert-divider"></div>
    <div class="right">
      ${qr ? `<div class="qr-wrap"><img class="qr-img" src="${qr}" alt="QR" /></div>` : '<div class="qr-wrap qr-empty"></div>'}
    </div>
  </div>
  ${copy.showSignature ? `
  <div class="sig-row">
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-label">INVENTORY COMMITTEE REPRESENTATIVE</div>
    </div>
  </div>` : ''}
  <div class="footer">
    <div class="note-bold">NOTE - PLEASE DO NOT REMOVE</div>
    ${copy.showFinePrint ? `<div class="note-fine">${escapeHtml(copy.footerFine)}</div>` : ''}
  </div>
</div>`;
    };

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
    gap: 1mm;
    padding: 1mm;
    page-break-after: always;
    break-after: page;
  }
  .page:last-child { page-break-after: avoid; break-after: avoid; }
  .sticker {
    background: #fff;
    color: #000;
    border: 1.2px solid #000;
    padding: 1.4mm 2mm 1mm;
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
    justify-content: space-between;
    gap: 1.5mm;
    flex-shrink: 0;
    padding-bottom: 0.8mm;
  }
  .logo { width: 9mm; height: 9mm; object-fit: contain; flex-shrink: 0; }
  .header-text { flex: 1; text-align: center; display: flex; flex-direction: column; gap: 0.4mm; }
  .lgu-name { font-size: 8px; font-weight: 900; letter-spacing: 0.06em; line-height: 1.1; }
  .city-name { font-size: 6.5px; font-weight: 700; letter-spacing: 0.18em; line-height: 1.1; }
  .divider { border-top: 0.7px solid #000; width: 100%; flex-shrink: 0; }
  .body {
    display: flex;
    align-items: stretch;
    flex: 1;
    min-height: 0;
    padding: 1mm 0 0.6mm;
    overflow: hidden;
  }
  .left {
    flex: 1 1 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-width: 0;
    overflow: hidden;
    padding-right: 1.5mm;
  }
  .field {
    display: flex;
    align-items: flex-end;
    font-size: 5.5px;
    line-height: 1.2;
    min-width: 0;
    overflow: hidden;
    width: 100%;
  }
  .fl { 
    font-weight: 900; 
    white-space: nowrap; 
    flex-shrink: 0; 
    width: 18mm;                   /* 👈 bumped 17mm → 18mm */
  }
  .fv {
    flex: 1 1 0;
    font-weight: 700;
    border-bottom: 0.5px solid #000;
    margin-left: 2mm;              /* 👈 FIX: was 1mm — pushes value right */
    padding: 0 1mm;                /* 👈 FIX: was 0 0.5mm — more breathing room */
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
    min-width: 0;
    max-width: 100%;
  }
  .vert-divider { width: 0.7px; background: #000; flex-shrink: 0; align-self: stretch; }
  .right {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding-left: 1.5mm;
    flex-shrink: 0;
    width: 24mm;
  }
  .qr-wrap  { border: 0.7px solid #000; padding: 0.6mm; display: inline-block; background: #fff; }
  .qr-img   { width: 21mm; height: 21mm; display: block; object-fit: contain; }
  .qr-empty { width: 21mm; height: 21mm; }
  .sig-row {
    display: flex;
    justify-content: center;
    flex-shrink: 0;
    padding-top: 0.6mm;
  }
  .sig-block { width: 45mm; text-align: center; }
  .sig-line  { border-top: 0.6px solid #000; margin-bottom: 0.4mm; }
  .sig-label { font-size: 3.4px; font-weight: 700; letter-spacing: 0.05em; }
  .footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    padding-top: 0.6mm;
  }
  .note-bold { font-size: 6px; font-weight: 900; letter-spacing: 0.08em; }
  .note-fine { 
    font-size: 3.8px; 
    font-weight: 400; 
    font-style: normal; 
    margin-top: 0.3mm; 
    text-transform: none;
  }
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
    const docType = normalizeDocType(item.documentType);
    const copy = getDocCopy(docType);
    const fields = getFields(item);

    const S = {
        root: {
            width: 360,
            height: 240,
            background: '#fff',
            color: '#000',
            border: '1.5px solid #000',
            fontFamily: 'Arial, Helvetica, sans-serif',
            display: 'flex' as const,
            flexDirection: 'column' as const,
            padding: '6px 8px 5px',
            textTransform: 'uppercase' as const,
            overflow: 'hidden',
        },
        header: {
            display: 'flex' as const,
            alignItems: 'center' as const,
            justifyContent: 'space-between' as const,
            gap: 6,
            flexShrink: 0,
            paddingBottom: 4,
        },
        headerText: { flex: 1, textAlign: 'center' as const, display: 'flex' as const, flexDirection: 'column' as const, gap: 1 },
        divider: { borderTop: '1px solid #000', width: '100%', flexShrink: 0 },
        body: { display: 'flex' as const, alignItems: 'stretch' as const, flex: 1, overflow: 'hidden', padding: '4px 0 3px' },
        left: {
            flex: 1,
            display: 'flex' as const,
            flexDirection: 'column' as const,
            justifyContent: 'space-between' as const,
            overflow: 'hidden',
            minWidth: 0,
            paddingRight: 6,
        },
        right: { width: 80, display: 'flex' as const, flexDirection: 'column' as const, alignItems: 'center' as const, justifyContent: 'center' as const, paddingLeft: 6, flexShrink: 0 },
        sigRow: { display: 'flex' as const, justifyContent: 'center' as const, flexShrink: 0, paddingTop: 3 },
        sigBlock: { width: 160, textAlign: 'center' as const },
        footer: { display: 'flex' as const, flexDirection: 'column' as const, alignItems: 'center' as const, flexShrink: 0, paddingTop: 3 },
    };

    const sticker = (
        <div style={S.root}>
            {/* Header */}
            <div style={S.header}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={LOGO_LEFT_SRC} alt="seal" style={{ width: 36, height: 36, objectFit: 'contain', flexShrink: 0 }} />
                <div style={S.headerText}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: '#000', letterSpacing: '0.06em', lineHeight: 1.1 }}>
                        LOCAL GOVERNMENT UNIT
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#000', letterSpacing: '0.18em', lineHeight: 1.1 }}>
                        EL SALVADOR CITY
                    </div>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={LOGO_RIGHT_SRC} alt="seal" style={{ width: 36, height: 36, objectFit: 'contain', flexShrink: 0 }} />
            </div>

            <div style={S.divider} />

            {/* Body */}
            <div style={S.body}>
                {/* Left — fields */}
                <div style={S.left}>
                    {fields.map(([label, value]) => (
                        <div
                            key={label}
                            style={{
                                display: 'flex',
                                alignItems: 'flex-end',
                                fontSize: 8.5,
                                lineHeight: 1.2,
                                minWidth: 0,
                                overflow: 'hidden',
                            }}
                        >
                            <span style={{ fontWeight: 900, whiteSpace: 'nowrap', flexShrink: 0, width: 124 }}>{label}</span>
                            <span style={{
                                flex: 1,
                                fontWeight: 700,
                                borderBottom: '0.7px solid #000',
                                marginLeft: 8,             /* 👈 FIX: was 4 — pushes value right */
                                padding: '0 4px',          /* 👈 FIX: was '0 2px' */
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                textAlign: 'left',
                                minWidth: 0,
                            }}>
                                {value}
                            </span>
                        </div>
                    ))}
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

            {/* Signature — PAR only */}
            {copy.showSignature && (
                <div style={S.sigRow}>
                    <div style={S.sigBlock}>
                        <div style={{ borderTop: '0.8px solid #000', marginBottom: 1 }} />
                        <div style={{ fontSize: 5.5, fontWeight: 700, letterSpacing: '0.05em' }}>INVENTORY COMMITTEE REPRESENTATIVE</div>
                    </div>
                </div>
            )}

            {/* Footer */}
            <div style={S.footer}>
                <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.08em' }}>NOTE - PLEASE DO NOT REMOVE</div>
                {copy.showFinePrint && (
                    <div style={{ fontSize: 6, fontWeight: 400, fontStyle: 'normal', marginTop: 1, textTransform: 'none' }}>
                        {copy.footerFine}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="flex flex-col items-center gap-4">
            {large ? (
                <div style={{ position: 'relative', width: 360 * 1.4, height: 240 * 1.4 }}>
                    <div style={{
                        transform: 'scale(1.4)',
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
    parIcsNumber,
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
    documentType,
    office,
    items,
}: PropertyStickerProps) {
    const [open, setOpen] = useState(false);

    const resolvedItems = useMemo<PropertyStickerItem[]>(() => {
        if (items && items.length > 0) return items;
        return [{
            propertyNumber: propertyNumber || '',
            parIcsNumber: parIcsNumber || '',
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
            documentType: documentType || '',
            office: office || department || '',
        }];
    }, [
        items, propertyNumber, parIcsNumber, custodianName, itemName, description, category,
        classification, date, acquisitionDate, unitCost, serialNumber, modelNumber, brand, url,
        endUserName, currentDepartmentHead, documentType, office, department,
    ]);

    const isSingle = resolvedItems.length === 1;

    const handlePrintItems = useCallback(
        async (itemsToPrint: PropertyStickerItem[], startIdx: number) => {
            const qrDataUrls = itemsToPrint.map((_, i) => {
                const container = document.getElementById(`sticker-qr-${startIdx + i}`);
                const canvas = container?.querySelector<HTMLCanvasElement>('canvas');
                return canvas ? canvas.toDataURL('image/png') : '';
            });
            const origin = window.location.origin;
            const [logoLeftDataUrl, logoRightDataUrl] = await Promise.all([
                imgToDataUrl(origin + LOGO_LEFT_SRC),
                imgToDataUrl(origin + LOGO_RIGHT_SRC),
            ]);
            const win = window.open('', 'gso-property-sticker-print');
            if (!win) return;
            win.document.open();
            win.document.write(buildPrintHtml(itemsToPrint, qrDataUrls, logoLeftDataUrl, logoRightDataUrl));
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

// ── Standalone bulk-print helper (used by AllItemsPage selection mode) ─────────
// Renders QR codes off-screen, captures them, then opens a print window.
export async function printPropertyStickers(items: PropertyStickerItem[]): Promise<void> {
    if (items.length === 0) return;

    // Render QR codes into hidden container to get canvas data URLs
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;visibility:hidden;pointer-events:none;';
    document.body.appendChild(container);

    // Create a temporary React root to render QRCodeCanvas elements
    const { createRoot } = await import('react-dom/client');
    const root = createRoot(container);

    await new Promise<void>(resolve => {
        root.render(
            React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap' } },
                ...items.map((item, i) =>
                    React.createElement('div', { key: i, id: `bulk-sticker-qr-${i}` },
                        React.createElement(QRCodeCanvas, {
                            value: item.url || 'https://iams-gso.gov.ph',
                            size: 80,
                            level: 'M',
                            includeMargin: false,
                            bgColor: '#ffffff',
                            fgColor: '#000000',
                        })
                    )
                )
            )
        );
        // Allow React to flush
        setTimeout(resolve, 200);
    });

    const qrDataUrls = items.map((_, i) => {
        const wrapper = container.querySelector<HTMLElement>(`#bulk-sticker-qr-${i}`);
        const canvas = wrapper?.querySelector<HTMLCanvasElement>('canvas');
        return canvas ? canvas.toDataURL('image/png') : '';
    });

    const origin = window.location.origin;
    const [logoLeftDataUrl, logoRightDataUrl] = await Promise.all([
        imgToDataUrl(origin + LOGO_LEFT_SRC),
        imgToDataUrl(origin + LOGO_RIGHT_SRC),
    ]);

    root.unmount();
    document.body.removeChild(container);

    const win = window.open('', 'gso-property-sticker-print');
    if (!win) return;
    win.document.open();
    win.document.write(buildPrintHtml(items, qrDataUrls, logoLeftDataUrl, logoRightDataUrl));
    win.document.close();
}
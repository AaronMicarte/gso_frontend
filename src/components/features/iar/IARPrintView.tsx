import React from 'react';
import { IAR } from '@/types/iar';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { resolveSignatureUrl } from '@/lib/utils/signature';

interface IARPrintViewProps {
    iar: IAR;
    // Optional runtime overrides (data URLs) used to ensure images appear in print previews
    printSignatures?: { inspected?: string | null; accepted?: string | null } | null;
}

export const IARPrintView = React.forwardRef<HTMLDivElement, IARPrintViewProps>(({ iar, printSignatures }, ref) => {
    const formatDate = (dateString?: string) => {
        if (!dateString) return '';
        return format(toZonedTime(new Date(dateString), 'Asia/Manila'), 'yyyy-MM-dd');
    };

    // Resolve inline or stored signature URLs (data URLs returned as-is)
    const inspectedSigUrl = resolveSignatureUrl(iar, 'inspected');
    const acceptedSigUrl = resolveSignatureUrl(iar, 'accepted');

    // If the print flow requests runtime embedded signatures, listen for events and use them
    const [runtimePrintSignatures, setRuntimePrintSignatures] = React.useState<{ inspected?: string | null; accepted?: string | null } | null>(printSignatures || null);

    React.useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail as { inspected?: string | null; accepted?: string | null };
            setRuntimePrintSignatures(detail || null);
        };
        const clearHandler = () => setRuntimePrintSignatures(null);
        window.addEventListener('gso:print-signatures', handler as EventListener);
        window.addEventListener('afterprint', clearHandler);
        return () => {
            window.removeEventListener('gso:print-signatures', handler as EventListener);
            window.removeEventListener('afterprint', clearHandler);
        };
    }, []);

    // Prefer streaming endpoint for print (handles local/public disks where direct url may 404)
    // For printing prefer the public streaming endpoint for local disk (safer than direct storage url)
    const inspectedPrintUrl = inspectedSigUrl && !inspectedSigUrl.startsWith('data:')
        ? `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/signatures/${iar.IARID}/inspected`
        : inspectedSigUrl;
    const acceptedPrintUrl = acceptedSigUrl && !acceptedSigUrl.startsWith('data:')
        ? `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/signatures/${iar.IARID}/accepted`
        : acceptedSigUrl;

    // Prefer runtime embedded signatures (data URLs) when available for print
    const inspectedFinal = runtimePrintSignatures?.inspected ?? inspectedPrintUrl;
    const acceptedFinal = runtimePrintSignatures?.accepted ?? acceptedPrintUrl;

    // Calculate total amount
    const totalAmount = iar.details?.reduce((sum, detail) => {
        const unitCost = detail.drDetail?.UnitCost || 0;
        const qty = detail.QuantityAccepted; // Only count accepted items for total value? Or delivered? Usually delivered.
        // Appendix 62 usually lists what was delivered and then inspected.
        // But let's list what was delivered.
        const deliveredQty = detail.drDetail?.QuantityDelivered || 0;
        return sum + (unitCost * deliveredQty);
    }, 0) || 0;

    const acceptanceName = iar.acceptedByUser?.FullName || iar.deliveryReceipt?.requestedByUser?.FullName || '';

    return (
        <div ref={ref} className="print-container gso-print-doc bg-white p-8 max-w-4xl mx-auto text-black text-[11px]">
            {/* Header */}
            <div className="mb-4">
                <div className="flex justify-center items-start">
                    <h1 className="gso-print-title">Inspection and Acceptance Report</h1>
                </div>

                <div className="text-left border-b-2 border-black pb-2 mt-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p><span className="font-bold">Entity Name:</span> <span className="underline">LGU EL SALVADOR CITY</span></p>
                        </div>
                        <div>
                            <p><span className="font-bold">Fund Cluster:</span> <span className="underline">____________________</span></p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Info Grid */}
            <div className="border border-black mb-4">
                <div className="grid grid-cols-2 divide-x divide-black">
                    <div className="p-2 space-y-2">
                        <p><span className="font-bold">Supplier:</span> {iar.deliveryReceipt?.SupplierName}</p>
                        <p><span className="font-bold">PO No./Date:</span> {iar.deliveryReceipt?.PONumber || '____________________'}</p>
                        <p><span className="font-bold">Requisitioning Office/Dept:</span> ____________________</p>
                        <p><span className="font-bold">Responsibility Center Code:</span> ____________________</p>
                    </div>
                    <div className="p-2 space-y-2">
                        <p><span className="font-bold">IAR No.:</span> {iar.IARNumber}</p>
                        <p><span className="font-bold">Date:</span> {formatDate(iar.CreatedDate)}</p>
                        <p><span className="font-bold">Invoice No.:</span> {iar.deliveryReceipt?.InvoiceNumber || '____________________'}</p>
                        <p><span className="font-bold">Date:</span> {formatDate(iar.deliveryReceipt?.DateReceived)}</p>
                    </div>
                </div>
            </div>

            {/* Items Table */}
            <table className="w-full border-collapse border border-black mb-2" style={{ borderWidth: '1.5px' }}>
                <thead>
                    <tr className="text-center">
                        <th className="border border-black p-1 w-20">Stock/Property No.</th>
                        <th className="border border-black p-1">Description</th>
                        <th className="border border-black p-1 w-16">Unit</th>
                        <th className="border border-black p-1 w-20">Quantity</th>
                        <th className="border border-black p-1 w-32">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {iar.details?.map((detail, index) => (
                        <tr key={index}>
                            <td className="border border-black p-1 text-center" style={{ verticalAlign: 'top' }}>{index + 1}</td>
                            <td className="border border-black p-1" style={{ verticalAlign: 'top' }}>
                                <div className="font-semibold">{detail.drDetail?.ItemDescription}</div>
                            </td>
                            <td className="border border-black p-1 text-center" style={{ verticalAlign: 'top' }}>{detail.drDetail?.unitOfMeasure?.UnitName || detail.drDetail?.UnitName || ''}</td>
                            <td className="border border-black p-1 text-center" style={{ verticalAlign: 'top' }}>{detail.drDetail?.QuantityDelivered}</td>
                            <td className="border border-black p-1 text-right" style={{ verticalAlign: 'top' }}>
                                {((detail.drDetail?.QuantityDelivered || 0) * (detail.drDetail?.UnitCost || 0)).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}
                            </td>
                        </tr>
                    ))}
                    {/* Empty rows to fill space if needed */}
                    {[...Array(Math.max(0, 3 - (iar.details?.length || 0)))].map((_, i) => (
                        <tr key={`empty-${i}`}>
                            <td className="border border-black p-1">&nbsp;</td>
                            <td className="border border-black p-1">&nbsp;</td>
                            <td className="border border-black p-1">&nbsp;</td>
                            <td className="border border-black p-1">&nbsp;</td>
                            <td className="border border-black p-1">&nbsp;</td>
                        </tr>
                    ))}
                    <tr>
                        <td colSpan={4} className="border border-black p-1 text-right font-bold">TOTAL AMOUNT</td>
                        <td className="border border-black p-1 text-right font-bold">
                            {totalAmount.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}
                        </td>
                    </tr>
                </tbody>
            </table>

            {/* Inspection and Acceptance Section */}
            <div className="border border-black" style={{ borderWidth: '1.2px' }}>
                <div className="grid grid-cols-2 divide-x divide-black">
                    {/* Inspection */}
                    <div className="p-2">
                        <h3 className="font-bold text-center mb-2 border-b border-black pb-1">INSPECTION</h3>
                        <div className="mb-2">
                            <p className="mb-2">Date Inspected: <span className="inline-block border-b border-black min-w-[160px]">{formatDate(iar.DateInspected)}</span></p>
                            <div className="flex items-start gap-2">
                                <div className="border border-black w-4 h-4 mt-1 flex items-center justify-center">
                                    ✓
                                </div>
                                <p className="text-sm">Inspected, verified and found in order as to quantity and specifications.</p>
                            </div>
                        </div>

                        <div className="mt-4 text-center">
                            <div className="h-10" />
                            <p className="font-bold uppercase" style={{ marginTop: 6, borderBottom: '1px solid black', minHeight: '1.2em', display: 'inline-block', width: '100%', textAlign: 'center', position: 'relative', zIndex: 1 }}>{iar.inspectedByUser?.FullName || ''}</p>

                            <p className="text-xs">Inspector Officer/Inspection Committee</p>
                        </div>
                    </div>

                    {/* Acceptance */}
                    <div className="p-2">
                        <h3 className="font-bold text-center mb-2 border-b border-black pb-1">ACCEPTANCE</h3>
                        <div className="mb-2">
                            <p className="mb-2">Date Received: <span className="inline-block border-b border-black min-w-[160px]">{formatDate(iar.DateAccepted)}</span></p>
                            <div className="flex items-start gap-2 mb-1">
                                <div className="border border-black w-4 h-4 mt-1 flex items-center justify-center">

                                </div>
                                <p className="text-sm">Complete</p>
                            </div>
                            <div className="flex items-start gap-2">
                                <div className="border border-black w-4 h-4 mt-1 flex items-center justify-center">

                                </div>
                                <p className="text-sm">Partial (pls. specify quantity)</p>
                            </div>
                        </div>

                        <div className="mt-4 text-center">
                            <div className="h-10" />
                            <p className="font-bold uppercase" style={{ marginTop: 6, borderBottom: '1px solid black', minHeight: '1.2em', display: 'inline-block', width: '100%', textAlign: 'center', position: 'relative', zIndex: 1 }}>{acceptanceName}</p>

                            <p className="text-xs">Supply and/or Property Custodian</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

IARPrintView.displayName = 'IARPrintView';

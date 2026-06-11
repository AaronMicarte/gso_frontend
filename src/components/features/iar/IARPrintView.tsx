import React from 'react';
import { compressPropertyNumbers } from '@/lib/utils/propertyNumbers';
import { IAR } from '@/types/iar';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { resolveSignatureUrl } from '@/lib/utils/signature';

interface IARPrintViewProps {
    iar: IAR;
    printSignatures?: { inspected?: string | null; accepted?: string | null } | null;
}

export const IARPrintView = React.forwardRef<HTMLDivElement, IARPrintViewProps>(
    ({ iar, printSignatures }, ref) => {

        const formatDate = (dateString?: string) => {
            if (!dateString) return '';
            return format(toZonedTime(new Date(dateString), 'Asia/Manila'), 'yyyy-MM-dd');
        };

        const inspectedSigUrl = resolveSignatureUrl(iar, 'inspected');
        const acceptedSigUrl = resolveSignatureUrl(iar, 'accepted');

        const [runtimePrintSignatures, setRuntimePrintSignatures] = React.useState(printSignatures || null);

        React.useEffect(() => {
            const handler = (e: Event) => {
                const detail = (e as CustomEvent).detail;
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

        const inspectedPrintUrl = inspectedSigUrl && !inspectedSigUrl.startsWith('data:')
            ? `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/signatures/${iar.IARID}/inspected`
            : inspectedSigUrl;

        const acceptedPrintUrl = acceptedSigUrl && !acceptedSigUrl.startsWith('data:')
            ? `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/signatures/${iar.IARID}/accepted`
            : acceptedSigUrl;

        const inspectedFinal = runtimePrintSignatures?.inspected ?? inspectedPrintUrl;
        const acceptedFinal = runtimePrintSignatures?.accepted ?? acceptedPrintUrl;

        const totalAmount = iar.details?.reduce((sum, d) => {
            const qty = d.drDetail?.QuantityDelivered || 0;
            const cost = d.drDetail?.UnitCost || 0;
            return sum + (qty * cost);
        }, 0) || 0;

        const acceptanceName =
            iar.acceptedByUser?.FullName ||
            iar.deliveryReceipt?.requestedByUser?.FullName ||
            '';

        return (
            <div ref={ref} className="bg-white p-8 max-w-4xl mx-auto text-black text-[11px]">

                {/* HEADER */}
                <div className="mb-4">
                    <h1 className="text-center font-bold text-lg">Inspection and Acceptance Report</h1>

                    <div className="border-b-2 border-black mt-2 pb-2 grid grid-cols-2">
                        <p><b>Entity Name:</b> LGU EL SALVADOR CITY</p>
                        <p><b>Fund Cluster:</b> ____________________</p>
                    </div>
                </div>

                {/* INFO */}
                <div className="border border-black mb-4">
                    <div className="grid grid-cols-2 divide-x divide-black">
                        <div className="p-2 space-y-1">
                            <p><b>Supplier:</b> {iar.deliveryReceipt?.SupplierName}</p>
                            <p><b>PO No./Date:</b> {iar.deliveryReceipt?.PONumber || '________'}</p>
                            <p><b>Requisitioning Office:</b> __________</p>
                            <p><b>Responsibility Center Code:</b> __________</p>
                        </div>
                        <div className="p-2 space-y-1">
                            <p><b>IAR No.:</b> {iar.IARNumber}</p>
                            <p><b>Date:</b> {formatDate(iar.CreatedDate)}</p>
                            <p><b>Invoice No.:</b> {iar.deliveryReceipt?.InvoiceNumber || '________'}</p>
                            <p><b>Date:</b> {formatDate(iar.deliveryReceipt?.DateReceived)}</p>
                        </div>
                    </div>
                </div>

                {/* ITEMS TABLE */}
                <table className="w-full border border-black border-collapse mb-3">
                    <thead>
                        <tr>
                            <th className="border border-black p-1">Stock No.</th>
                            <th className="border border-black p-1">Description</th>
                            <th className="border border-black p-1">Unit</th>
                            <th className="border border-black p-1">Qty</th>
                            <th className="border border-black p-1">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {iar.details?.map((d, i) => {
                            const drDetailAny: any = d.drDetail as any;
                            const propertyNumbers = drDetailAny?.propertyNumbers ?? (drDetailAny?.inventory_details?.map((inv: any) => inv.PropertyNumber).filter(Boolean) ?? []);
                            const propNumStr = Array.isArray(propertyNumbers) ? propertyNumbers.join('/') : (propertyNumbers || '');
                            const compressed = compressPropertyNumbers(propNumStr);
                            return (
                                <tr key={i}>
                                    <td className="border border-black text-center">{compressed || (i + 1)}</td>
                                    <td className="border border-black p-1">{d.drDetail?.ItemDescription}</td>
                                    <td className="border border-black text-center">{d.drDetail?.UnitName}</td>
                                    <td className="border border-black text-center">{d.drDetail?.QuantityDelivered}</td>
                                    <td className="border border-black text-right">
                                        {((d.drDetail?.QuantityDelivered || 0) * (d.drDetail?.UnitCost || 0))
                                            .toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}
                                    </td>
                                </tr>
                            );
                        })}

                        <tr>
                            <td colSpan={4} className="border border-black text-right font-bold">TOTAL</td>
                            <td className="border border-black text-right font-bold">
                                {totalAmount.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/*  FIXED INSPECTION + ACCEPTANCE */}
                <table className="w-full border-2 border-black border-collapse text-[11px]">
                    <tbody>
                        <tr className="border-b-2 border-black">

                            {/* INSPECTION */}
                            <td className="w-1/2 border-r-2 border-black align-top h-[180px] p-0">
                                <div className="flex flex-col h-full min-h-[180px]">

                                    <div className="border-b border-black text-center font-bold py-1">
                                        INSPECTION
                                    </div>

                                    <div className="p-2 flex-1">
                                        <p>
                                            Date Inspected:
                                            <span className="ml-1 border-b border-black inline-block min-w-[150px]">
                                                {formatDate(iar.DateInspected)}
                                            </span>
                                        </p>

                                        <div className="flex gap-2 mt-2">
                                            <div className="w-4 h-4 border border-black flex items-center justify-center">
                                                ✓
                                            </div>
                                            <p>
                                                Inspected, verified and found in order as to quantity and specifications.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="border border-black p-2 text-center">
                                        <div className="h-10" />
                                        <p className="border-b border-black font-bold uppercase">
                                            {iar.inspectedByUser?.FullName || ''}
                                        </p>
                                        <p className="text-xs">Inspection Officer/Inspection Committee</p>
                                    </div>

                                </div>
                            </td>

                            {/* ACCEPTANCE */}
                            <td className="w-1/2 align-top h-[180px] p-0">
                                <div className="flex flex-col h-full min-h-[180px]">

                                    <div className="border-b border-black text-center font-bold py-1">
                                        ACCEPTANCE
                                    </div>

                                    <div className="p-2 flex-1">
                                        <p>
                                            Date Received:
                                            <span className="ml-1 border-b border-black inline-block min-w-[150px]">
                                                {formatDate(iar.DateAccepted)}
                                            </span>
                                        </p>

                                        <div className="flex gap-2 mt-2">
                                            <div className="w-4 h-4 border border-black"></div>
                                            <p>Complete</p>
                                        </div>

                                        <div className="flex gap-2 mt-1">
                                            <div className="w-4 h-4 border border-black"></div>
                                            <p>Partial (pls. specify quantity)</p>
                                        </div>
                                    </div>

                                    <div className="border border-black p-2 text-center">
                                        <div className="h-10" />
                                        <p className="border-b border-black font-bold uppercase">
                                            {acceptanceName}
                                        </p>
                                        <p className="text-xs">Supply and/or Property Custodian</p>
                                    </div>

                                </div>
                            </td>

                        </tr>
                    </tbody>
                </table>

            </div>
        );
    });

IARPrintView.displayName = 'IARPrintView';

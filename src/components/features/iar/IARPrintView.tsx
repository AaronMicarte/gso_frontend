import React from 'react';
import { IAR } from '@/types/iar';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

interface IARPrintViewProps {
    iar: IAR;
}

export const IARPrintView = React.forwardRef<HTMLDivElement, IARPrintViewProps>(({ iar }, ref) => {
    const formatDate = (dateString?: string) => {
        if (!dateString) return '';
        return format(toZonedTime(new Date(dateString), 'Asia/Manila'), 'yyyy-MM-dd');
    };

    // Calculate total amount
    const totalAmount = iar.details?.reduce((sum, detail) => {
        const unitCost = detail.drDetail?.UnitCost || 0;
        const qty = detail.QuantityAccepted; // Only count accepted items for total value? Or delivered? Usually delivered.
        // Appendix 62 usually lists what was delivered and then inspected.
        // But let's list what was delivered.
        const deliveredQty = detail.drDetail?.QuantityDelivered || 0;
        return sum + (unitCost * deliveredQty);
    }, 0) || 0;

    return (
        <div ref={ref} className="hidden print:block p-8 bg-white text-black font-serif text-sm">
            {/* Header */}
            <div className="text-center mb-6">
                <h1 className="font-bold text-xl mb-2">INSPECTION AND ACCEPTANCE REPORT</h1>
                <div className="text-left border-b-2 border-black pb-2 mb-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p><span className="font-bold">Entity Name:</span> LGU EL SALVADOR CITY</p>
                        </div>
                        <div>
                            <p><span className="font-bold">Fund Cluster:</span> ____________________</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Info Grid */}
            <div className="border border-black mb-4">
                <div className="grid grid-cols-2 divide-x divide-black">
                    <div className="p-2 space-y-2">
                        <p><span className="font-bold">Supplier:</span> {iar.deliveryReceipt?.SupplierName}</p>
                        <p><span className="font-bold">PO No./Date:</span> {iar.deliveryReceipt?.PONumber || '____________________'} / ____________________</p>
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
            <table className="w-full border-collapse border border-black mb-4">
                <thead>
                    <tr className="text-center">
                        <th className="border border-black p-1 w-20">Stock/ Property No.</th>
                        <th className="border border-black p-1">Description</th>
                        <th className="border border-black p-1 w-16">Unit</th>
                        <th className="border border-black p-1 w-16">Qty</th>
                        <th className="border border-black p-1 w-24">Unit Cost</th>
                        <th className="border border-black p-1 w-24">Total Cost</th>
                    </tr>
                </thead>
                <tbody>
                    {iar.details?.map((detail, index) => (
                        <tr key={index}>
                            <td className="border border-black p-1 text-center">{index + 1}</td>
                            <td className="border border-black p-1">
                                {detail.drDetail?.ItemDescription}
                                {detail.Remarks && <div className="text-xs italic">({detail.Remarks})</div>}
                            </td>
                            <td className="border border-black p-1 text-center">Unit</td>
                            <td className="border border-black p-1 text-center">{detail.drDetail?.QuantityDelivered}</td>
                            <td className="border border-black p-1 text-right">
                                {detail.drDetail?.UnitCost?.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}
                            </td>
                            <td className="border border-black p-1 text-right">
                                {((detail.drDetail?.QuantityDelivered || 0) * (detail.drDetail?.UnitCost || 0)).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}
                            </td>
                        </tr>
                    ))}
                    {/* Empty rows to fill space if needed */}
                    {[...Array(Math.max(0, 5 - (iar.details?.length || 0)))].map((_, i) => (
                        <tr key={`empty-${i}`}>
                            <td className="border border-black p-1">&nbsp;</td>
                            <td className="border border-black p-1">&nbsp;</td>
                            <td className="border border-black p-1">&nbsp;</td>
                            <td className="border border-black p-1">&nbsp;</td>
                            <td className="border border-black p-1">&nbsp;</td>
                            <td className="border border-black p-1">&nbsp;</td>
                        </tr>
                    ))}
                    <tr>
                        <td colSpan={5} className="border border-black p-1 text-right font-bold">TOTAL</td>
                        <td className="border border-black p-1 text-right font-bold">
                            {totalAmount.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}
                        </td>
                    </tr>
                </tbody>
            </table>

            {/* Inspection and Acceptance Section */}
            <div className="border border-black">
                <div className="grid grid-cols-2 divide-x divide-black">
                    {/* Inspection */}
                    <div className="p-2">
                        <h3 className="font-bold text-center mb-4 border-b border-black pb-1">INSPECTION</h3>
                        <div className="mb-4">
                            <p className="mb-2">Date Inspected: <span className="underline">{formatDate(iar.DateInspected)}</span></p>
                            <div className="flex items-start gap-2">
                                <div className="border border-black w-4 h-4 mt-1 flex items-center justify-center">
                                    {/* Checkbox logic could go here */}
                                    ✓
                                </div>
                                <p className="text-sm">Inspected, verified and found in order as to quantity and specifications.</p>
                            </div>
                        </div>
                        <div className="mt-12 text-center">
                            <p className="font-bold uppercase underline">{iar.inspectedByUser?.FullName || '____________________'}</p>
                            <p className="text-xs">Inspection Officer/Inspection Committee</p>
                        </div>
                    </div>

                    {/* Acceptance */}
                    <div className="p-2">
                        <h3 className="font-bold text-center mb-4 border-b border-black pb-1">ACCEPTANCE</h3>
                        <div className="mb-4">
                            <p className="mb-2">Date Received: <span className="underline">{formatDate(iar.DateAccepted || iar.DateInspected)}</span></p>
                            <div className="flex items-start gap-2 mb-1">
                                <div className="border border-black w-4 h-4 mt-1 flex items-center justify-center">
                                    {/* Partial/Complete logic */}
                                    {iar.details?.some(d => d.QuantityRejected > 0) ? '' : '✓'}
                                </div>
                                <p className="text-sm">Complete</p>
                            </div>
                            <div className="flex items-start gap-2">
                                <div className="border border-black w-4 h-4 mt-1 flex items-center justify-center">
                                    {iar.details?.some(d => d.QuantityRejected > 0) ? '✓' : ''}
                                </div>
                                <p className="text-sm">Partial (pls. specify quantity)</p>
                            </div>
                        </div>
                        <div className="mt-8 text-center">
                            <p className="font-bold uppercase underline">{iar.acceptedByUser?.FullName || '____________________'}</p>
                            <p className="text-xs">Supply and/or Property Custodian</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

IARPrintView.displayName = 'IARPrintView';

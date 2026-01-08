import React from 'react';
import { AssetIssuance } from '@/types/assetIssuance';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

interface ICSPrintViewProps {
    issuance: AssetIssuance;
    printSignature?: string | null;
}

export const ICSPrintView = React.forwardRef<HTMLDivElement, ICSPrintViewProps>(({ issuance, printSignature }, ref) => {
    const formatDate = (dateString?: string) => {
        if (!dateString) return '';
        return format(toZonedTime(new Date(dateString), 'Asia/Manila'), 'yyyy-MM-dd');
    };

    const formatTime = (dateString?: string) => {
        if (!dateString) return '';
        return format(toZonedTime(new Date(dateString), 'Asia/Manila'), 'HH:mm');
    };

    const [runtimePrintSignature, setRuntimePrintSignature] = React.useState<string | null>(printSignature || null);

    React.useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail as { signature?: string | null };
            setRuntimePrintSignature(detail?.signature || null);
        };
        const clearHandler = () => setRuntimePrintSignature(null);
        window.addEventListener('gso:print-ics-signature', handler as EventListener);
        window.addEventListener('afterprint', clearHandler);
        return () => {
            window.removeEventListener('gso:print-ics-signature', handler as EventListener);
            window.removeEventListener('afterprint', clearHandler);
        };
    }, []);

    // Use runtime signature if available, otherwise use stored signature
    const finalSignature = runtimePrintSignature || issuance.signature_url;

    return (
        <div ref={ref} className="print-container bg-white p-8 max-w-4xl mx-auto text-black">
            {/* Print-specific styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                    @media print {
                        .print-container {
                            padding: 0;
                            max-width: none;
                            margin: 0;
                            font-size: 12px;
                            line-height: 1.3;
                        }
                        .no-print {
                            display: none !important;
                        }
                        .print-page-break {
                            page-break-after: always;
                        }
                    }
                `
            }} />

            {/* Header */}
            <div className="text-center mb-6 border-b-2 border-black pb-4">
                <div className="text-xs mb-2">Republic of the Philippines</div>
                <div className="text-xs mb-2">Province of Misamis Oriental</div>
                <div className="text-sm font-bold mb-2">CITY OF EL SALVADOR</div>
                <div className="text-xs mb-4">General Services Office</div>

                <div className="text-lg font-bold">INVENTORY CUSTODIAN SLIP</div>
                <div className="text-sm">(ICS)</div>
            </div>

            {/* Document Information */}
            <div className="mb-6">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                        <div className="mb-2">
                            <span className="text-sm font-semibold">ICS No.: </span>
                            <span className="border-b border-black px-2 text-sm">{issuance.DocumentNumber}</span>
                        </div>
                        <div className="mb-2">
                            <span className="text-sm font-semibold">Date: </span>
                            <span className="border-b border-black px-2 text-sm">{formatDate(issuance.IssuanceDate)}</span>
                        </div>
                    </div>
                    <div className="flex-1 text-right">
                        <div className="mb-2">
                            <span className="text-sm font-semibold">Time: </span>
                            <span className="border-b border-black px-2 text-sm">{formatTime(issuance.IssuanceDate)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Custodian Information */}
            <div className="mb-6 p-4 border border-black">
                <div className="text-sm font-bold mb-3">INVENTORY CUSTODIAN INFORMATION:</div>
                <div className="grid grid-cols-1 gap-2">
                    <div className="flex">
                        <span className="text-sm font-semibold w-32">Name:</span>
                        <span className="border-b border-black px-2 text-sm flex-1">
                            {issuance.issuedToUser?.FullName || ''}
                        </span>
                    </div>
                    <div className="flex">
                        <span className="text-sm font-semibold w-32">Position:</span>
                        <span className="border-b border-black px-2 text-sm flex-1">
                            {/* Position would need to be added to the user relationship */}
                            ________________________
                        </span>
                    </div>
                    <div className="flex">
                        <span className="text-sm font-semibold w-32">Department:</span>
                        <span className="border-b border-black px-2 text-sm flex-1">
                            {issuance.issuedToUser?.department?.DepartmentName || ''}
                        </span>
                    </div>
                    <div className="flex">
                        <span className="text-sm font-semibold w-32">Employee ID:</span>
                        <span className="border-b border-black px-2 text-sm flex-1">
                            {issuance.issuedToUser?.UserID || ''}
                        </span>
                    </div>
                </div>
            </div>

            {/* Item Details */}
            <div className="mb-6">
                <div className="text-sm font-bold mb-3">SEMI-EXPENDABLE PROPERTY DETAILS:</div>
                <table className="w-full border-collapse border border-black text-xs">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="border border-black p-2 text-left">Item Description</th>
                            <th className="border border-black p-2 text-center w-20">Quantity</th>
                            <th className="border border-black p-2 text-center w-16">Unit</th>
                            <th className="border border-black p-2 text-left w-32">Brand/Model</th>
                            <th className="border border-black p-2 text-left w-32">Serial Number</th>
                            <th className="border border-black p-2 text-left">Condition</th>
                            <th className="border border-black p-2 text-left">Remarks</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="border border-black p-2">
                                {issuance.inventoryDetail?.propertyInventory?.ItemDescription || ''}
                            </td>
                            <td className="border border-black p-2 text-center">
                                {issuance.QuantityIssued}
                            </td>
                            <td className="border border-black p-2 text-center">
                                {issuance.inventoryDetail?.unitOfMeasure?.UnitName || ''}
                            </td>
                            <td className="border border-black p-2">
                                {issuance.inventoryDetail?.propertyInventory?.Brand || ''}
                                {issuance.inventoryDetail?.propertyInventory?.ModelNumber &&
                                    ` - ${issuance.inventoryDetail.propertyInventory.ModelNumber}`
                                }
                            </td>
                            <td className="border border-black p-2">
                                {issuance.inventoryDetail?.propertyInventory?.SerialNumber || ''}
                            </td>
                            <td className="border border-black p-2">
                                {issuance.inventoryDetail?.condition?.ConditionName || 'Good'}
                            </td>
                            <td className="border border-black p-2">
                                {issuance.IssuanceNotes || ''}
                            </td>
                        </tr>
                        {/* Add empty rows for formatting */}
                        {Array.from({ length: 5 }, (_, i) => (
                            <tr key={i}>
                                <td className="border border-black p-2 h-8">&nbsp;</td>
                                <td className="border border-black p-2">&nbsp;</td>
                                <td className="border border-black p-2">&nbsp;</td>
                                <td className="border border-black p-2">&nbsp;</td>
                                <td className="border border-black p-2">&nbsp;</td>
                                <td className="border border-black p-2">&nbsp;</td>
                                <td className="border border-black p-2">&nbsp;</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Purpose */}
            <div className="mb-6 p-4 border border-black">
                <div className="text-sm font-bold mb-2">PURPOSE/INTENDED USE:</div>
                <div className="text-sm min-h-[60px] border-b border-black pb-2">
                    {issuance.request?.Purpose || ''}
                </div>
            </div>

            {/* Important Notice */}
            <div className="mb-6 p-4 border-2 border-black bg-gray-50">
                <div className="text-xs font-bold mb-2">IMPORTANT NOTICE TO INVENTORY CUSTODIAN:</div>
                <div className="text-xs leading-relaxed">
                    <p className="mb-2">
                        1. You are hereby made responsible as custodian for the above-described semi-expendable property.
                    </p>
                    <p className="mb-2">
                        2. You shall exercise proper care and custody of the property for the exclusive use of your department/unit.
                    </p>
                    <p className="mb-2">
                        3. You shall maintain an inventory record and report immediately to the Property Officer any loss,
                        damage, or theft of the property.
                    </p>
                    <p className="mb-2">
                        4. The property shall remain under the custody of your department/unit until consumed,
                        worn out, or disposed of according to applicable regulations.
                    </p>
                    <p>
                        5. Any transfer of custodianship must be properly documented and approved by the Property Officer.
                    </p>
                </div>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 mt-8">
                {/* Issued By */}
                <div className="text-center">
                    <div className="mb-2 text-sm font-bold">ISSUED BY:</div>
                    <div className="border-b border-black mb-2 h-16 flex items-end justify-center pb-2">
                        {/* Property Officer signature would go here */}
                    </div>
                    <div className="text-xs">
                        <div className="font-semibold">{issuance.issuer?.FullName}</div>
                        <div>Property Officer / GSO</div>
                        <div>Date: {formatDate(issuance.IssuanceDate)}</div>
                    </div>
                </div>

                {/* Received By */}
                <div className="text-center">
                    <div className="mb-2 text-sm font-bold">RECEIVED BY:</div>
                    <div className="border-b border-black mb-2 h-16 flex items-end justify-center pb-2">
                        {finalSignature && (
                            <img
                                src={finalSignature}
                                alt="Custodian signature"
                                className="max-h-14 max-w-32 object-contain"
                            />
                        )}
                    </div>
                    <div className="text-xs">
                        <div className="font-semibold">{issuance.issuedToUser?.FullName}</div>
                        <div>Inventory Custodian</div>
                        <div>Date: {issuance.AcknowledgedAt ? formatDate(issuance.AcknowledgedAt) : '__________'}</div>
                    </div>
                </div>
            </div>

            {/* Department Head Approval (ICS typically requires this) */}
            <div className="grid grid-cols-1 mt-6">
                <div className="text-center">
                    <div className="mb-2 text-sm font-bold">APPROVED BY:</div>
                    <div className="border-b border-black mb-2 h-16 flex items-end justify-center pb-2">
                        {/* Department Head signature would go here */}
                    </div>
                    <div className="text-xs">
                        <div className="font-semibold">_________________________________</div>
                        <div>Department Head</div>
                        <div>Date: __________</div>
                    </div>
                </div>
            </div>

            {/* Custodian Notes */}
            {issuance.AcknowledgmentNotes && (
                <div className="mt-6 p-4 border border-black">
                    <div className="text-sm font-bold mb-2">CUSTODIAN NOTES:</div>
                    <div className="text-xs">{issuance.AcknowledgmentNotes}</div>
                </div>
            )}

            {/* Footer */}
            <div className="mt-8 text-center text-xs text-gray-600">
                <div>This is a computer-generated document. No signature required for system copy.</div>
                <div>Generated on: {format(new Date(), 'PPPp')}</div>
                <div>System Reference: {issuance.DocumentNumber}</div>
            </div>
        </div>
    );
});

ICSPrintView.displayName = 'ICSPrintView';
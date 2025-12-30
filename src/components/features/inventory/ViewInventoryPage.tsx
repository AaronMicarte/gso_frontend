'use client';

import { useInventory, useGenerateQr } from '@/lib/hooks/useInventory';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { Building2, User, Calendar, DollarSign, Package, CheckCircle, AlertTriangle, UserCheck, Archive, FileText, QrCode, Search, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useState, useMemo } from 'react';

export function ViewInventoryPage({ baseRoute }: { baseRoute: string }) {
    const params = useParams() as { id?: string };
    const id = Number(params?.id);

    const { data, isLoading, refetch } = useInventory(id);
    const generateQr = useGenerateQr();
    const [searchTerm, setSearchTerm] = useState('');

    const handleRefresh = () => {
        refetch();
        toast.success('Property record refreshed');
    };

    const filteredDetails = useMemo(() => {
        if (!data?.details) return [];
        if (!searchTerm) return data?.details || [];
        return (data?.details || []).filter(detail =>
            detail.dr_item_description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            detail.ItemDescription?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            detail.propertyType?.PropertyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            detail.Brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            detail.ModelNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            detail.SerialNumber?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [data?.details, searchTerm]);

    // Guard invalid id early — prevents runtime/TS issues when params are missing
    if (!id || Number.isNaN(id)) {
        return <div className="p-6 text-sm text-red-600">Invalid inventory id</div>;
    }

    const handleGenerateQr = async (detailId: number) => {
        try {
            await generateQr.mutateAsync({ id: detailId });
            toast.success('QR code generated successfully');
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to generate QR code';
            toast.error(msg);
        }
    };

    const getStatusBadge = (statusId?: number) => {
        switch (statusId) {
            case 1:
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3" />
                        Available
                    </span>
                );
            case 2:
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <UserCheck className="w-3 h-3" />
                        Assigned
                    </span>
                );
            case 3:
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                        <AlertTriangle className="w-3 h-3" />
                        For Repair
                    </span>
                );
            case 4:
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <AlertTriangle className="w-3 h-3" />
                        For Disposal
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                        <Archive className="w-3 h-3" />
                        Unassigned
                    </span>
                );
        }
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Property Accountability Record</h1>
                    <p className="text-slate-500 text-sm">Official property record under GSO custody</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleRefresh}
                        disabled={isLoading}
                        className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                    <Link
                        href={`${baseRoute}/issuance`}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
                    >
                        <FileText className="w-4 h-4" />
                        Create PAR/ICS
                    </Link>
                    <Link
                        href={`${baseRoute}/inventory`}
                        className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        <Archive className="w-4 h-4" />
                        Back to Ledger
                    </Link>
                </div>
            </div>

            {/* Property Overview */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
                        <span className="ml-2 text-slate-600">Loading property record...</span>
                    </div>
                ) : (
                    <>
                        {/* Property Header */}
                        <div className="mb-6">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <div className="text-sm text-slate-600 mb-1">Property Accountability Number</div>
                                    <div className="text-2xl font-bold text-slate-900">{data?.InventoryNumber}</div>
                                    {data?.Remarks && (
                                        <div className="text-sm text-slate-500 mt-1">{data.Remarks}</div>
                                    )}
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-slate-600 mb-1">Acquisition Date</div>
                                    <div className="flex items-center gap-1 text-slate-900">
                                        <Calendar className="w-4 h-4" />
                                        {format(toZonedTime(new Date(data?.DateAcquired || new Date()), 'Asia/Manila'), 'MMMM dd, yyyy')}
                                    </div>
                                </div>
                            </div>

                            {/* Property Summary Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Package className="w-5 h-5 text-blue-600" />
                                        <div className="text-sm font-medium text-slate-700">Total Items</div>
                                    </div>
                                    <div className="text-2xl font-bold text-slate-900">
                                        {data?.details?.reduce((sum, d) => sum + (d.Quantity || 0), 0) || 0}
                                    </div>
                                </div>
                                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                                    <div className="flex items-center gap-2 mb-2">
                                        <DollarSign className="w-5 h-5 text-green-600" />
                                        <div className="text-sm font-medium text-slate-700">Total Value</div>
                                    </div>
                                    <div className="text-2xl font-bold text-slate-900">
                                        ₱{Number(data?.details?.reduce((sum, d) => sum + (d.TotalCost || 0), 0) || 0).toFixed(2)}
                                    </div>
                                </div>
                                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CheckCircle className="w-5 h-5 text-green-600" />
                                        <div className="text-sm font-medium text-slate-700">Available</div>
                                    </div>
                                    <div className="text-2xl font-bold text-green-600">
                                        {data?.details?.filter(d => d.PropertyStatusID === 1).length || 0}
                                    </div>
                                </div>
                                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                                    <div className="flex items-center gap-2 mb-2">
                                        <UserCheck className="w-5 h-5 text-blue-600" />
                                        <div className="text-sm font-medium text-slate-700">Assigned</div>
                                    </div>
                                    <div className="text-2xl font-bold text-blue-600">
                                        {data?.details?.filter(d => d.PropertyStatusID === 2).length || 0}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Property Items Table */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-slate-900">Property Items Ledger</h3>
                                <div className="text-sm text-slate-500">
                                    {filteredDetails.length} item{filteredDetails.length !== 1 ? 's' : ''} in this record
                                </div>
                            </div>

                            {/* Search Input */}
                            <div className="mb-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                                    <input
                                        type="text"
                                        placeholder="Search items by name, description, brand, model, or serial..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                        <tr>
                                            <th className="px-6 py-4">Item Name</th>
                                            <th className="px-6 py-4">Description</th>
                                            <th className="px-6 py-4">Specifications</th>
                                            <th className="px-6 py-4">Quantity</th>
                                            <th className="px-6 py-4">Unit Cost</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4">Custodian</th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {filteredDetails.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                                                    <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                                    {searchTerm ? 'No items match your search' : 'No property items found in this record'}
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredDetails.map((d: {
                                                InventoryDetailID: number;
                                                ItemDescription?: string;
                                                Brand?: string;
                                                ModelNumber?: string;
                                                SerialNumber?: string;
                                                propertyType?: { PropertyName: string };
                                                Quantity: number;
                                                QuantityAvailable?: number;
                                                UnitCost: number;
                                                TotalCost: number;
                                                ConditionID?: number;
                                                PropertyStatusID?: number;
                                                custodianName?: string;
                                                qrCode?: { QRCodeData: string }
                                            }) => (
                                                <tr key={d.InventoryDetailID} className="hover:bg-slate-50">
                                                    <td className="px-6 py-4">
                                                        <div>
                                                            <div className="font-medium text-slate-900">
                                                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                                                {(d as any).dr_item_description || 'Property Item'}
                                                            </div>
                                                            <div className="text-xs text-slate-500 mt-1">
                                                                Item ID: {d.InventoryDetailID}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-600">
                                                        {d.propertyType?.PropertyName || '-'}
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-600">
                                                        <div className="space-y-1">
                                                            {d.Brand && <div className="text-xs">Brand: {d.Brand}</div>}
                                                            {d.ModelNumber && <div className="text-xs">Model: {d.ModelNumber}</div>}
                                                            {d.SerialNumber && <div className="text-xs">Serial: {d.SerialNumber}</div>}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-600">
                                                        <div>
                                                            <div className="font-medium">{d.Quantity}</div>
                                                            {d.QuantityAvailable && d.QuantityAvailable !== d.Quantity && (
                                                                <div className="text-xs text-slate-500">
                                                                    Available: {d.QuantityAvailable}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-600">
                                                        ₱{Number(d.UnitCost || 0).toFixed(2)}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {getStatusBadge(d.PropertyStatusID)}
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-600">
                                                        <div className="flex items-center gap-1">
                                                            <User className="w-3 h-3" />
                                                            {d.custodianName || 'GSO Property Custodian'}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {d.qrCode ? (
                                                                <a
                                                                    href={d.qrCode.QRCodeData}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                                                                    title="View QR Code"
                                                                >
                                                                    <QrCode className="w-4 h-4" />
                                                                </a>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleGenerateQr(d.InventoryDetailID)}
                                                                    className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                                                                    title="Generate QR Code"
                                                                >
                                                                    <QrCode className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            {d.PropertyStatusID === 1 && (
                                                                <Link
                                                                    href={`${baseRoute}/issuance/new?property_id=${d.InventoryDetailID}`}
                                                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                    title="Create PAR/ICS"
                                                                >
                                                                    <FileText className="w-4 h-4" />
                                                                </Link>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

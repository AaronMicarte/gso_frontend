'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useInventories, usePendingIngestion, useIngestFromIar } from '@/lib/hooks/useInventory';
import { Package, Eye, ArrowDownToLine } from 'lucide-react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { toast } from 'sonner';

export function InventoryListPage({ baseRoute }: { baseRoute: string }) {
    const [page, setPage] = useState(1);
    const { data, isLoading } = useInventories({ page, per_page: 10 });
    const { data: pendingIars, isLoading: isLoadingPending } = usePendingIngestion();
    const { mutate: ingest, isPending: isIngesting } = useIngestFromIar();

    const handleIngest = (iarId: number) => {
        ingest(iarId, {
            onSuccess: () => toast.success('Inventory ingested successfully'),
            onError: (err) => toast.error('Failed to ingest: ' + err.message)
        });
    };

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
                <p className="text-slate-500 text-sm">View inventory records and details</p>
            </div>

            {/* Pending Ingestion Section */}
            {pendingIars && pendingIars.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <h2 className="text-lg font-semibold text-amber-900 mb-2 flex items-center gap-2">
                        <ArrowDownToLine className="w-5 h-5" />
                        Pending Ingestion ({pendingIars.length})
                    </h2>
                    <p className="text-sm text-amber-700 mb-4">
                        The following Accepted IARs are ready to be added to the inventory ledger.
                    </p>
                    <div className="space-y-2">
                        {pendingIars.map((iar) => (
                            <div key={iar.IARID} className="flex items-center justify-between bg-white p-3 rounded-lg border border-amber-100 shadow-sm">
                                <div>
                                    <div className="font-medium text-slate-900">{iar.IARNumber}</div>
                                    <div className="text-xs text-slate-500">Accepted: {format(toZonedTime(new Date(iar.DateAccepted), 'Asia/Manila'), 'MMM dd, yyyy')}</div>
                                </div>
                                <button
                                    onClick={() => handleIngest(iar.IARID)}
                                    disabled={isIngesting}
                                    className="px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-md hover:bg-amber-700 disabled:opacity-50 transition-colors"
                                >
                                    {isIngesting ? 'Ingesting...' : 'Ingest to Inventory'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">Inventory Number</th>
                                <th className="px-6 py-4">Date Acquired</th>
                                <th className="px-6 py-4">Remarks</th>
                                <th className="px-6 py-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--primary)]"></div>
                                            Loading inventory...
                                        </div>
                                    </td>
                                </tr>
                            ) : data?.data?.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                                        <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                        No inventory found
                                    </td>
                                </tr>
                            ) : (
                                data?.data?.map((inv: { InventoryID: number; InventoryNumber: string; DateAcquired: string; Remarks?: string }) => (
                                    <tr key={inv.InventoryID} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 font-medium text-slate-900">{inv.InventoryNumber}</td>
                                        <td className="px-6 py-4 text-slate-600">{format(toZonedTime(new Date(inv.DateAcquired), 'Asia/Manila'), 'MMM dd, yyyy')}</td>
                                        <td className="px-6 py-4 text-slate-600">{inv.Remarks}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Link href={`${baseRoute}/inventory/${inv.InventoryID}`} className="p-1 text-slate-400 hover:text-slate-600 transition-colors" title="View Details">
                                                    <Eye className="w-4 h-4" />
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {data?.meta && data?.meta?.last_page > 1 && (
                    <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-slate-500">Showing {((data?.meta?.current_page ?? 1 - 1) * (data?.meta?.per_page ?? 10)) + 1} to {Math.min((data?.meta?.current_page ?? 1) * (data?.meta?.per_page ?? 10), data?.meta?.total ?? 0)} of {data?.meta?.total ?? 0} entries</div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-3 py-1 text-sm border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
                                <span className="text-sm text-slate-600">Page {data?.meta?.current_page ?? 1} of {data?.meta?.last_page ?? 1}</span>
                                <button onClick={() => setPage(Math.min(data?.meta?.last_page ?? 1, page + 1))} disabled={page === (data?.meta?.last_page ?? 1)} className="px-3 py-1 text-sm border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

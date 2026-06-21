"use client";

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Package } from 'lucide-react';
import { toast } from 'sonner';
import { UnserviceableItemRow } from '@/types/propertyWaste';
import { listUnserviceable } from '@/lib/api/propertyWaste';

export default function IirupPage() {
    const [rows, setRows] = useState<UnserviceableItemRow[] | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const data = await listUnserviceable({ per_page: 100 });
                const rawItems = data?.data || [];

                const formattedItems: UnserviceableItemRow[] = rawItems.map((it: any) => {
                    const inv = it?.inventoryDetail || null;

                    return {
                        id: it.PropertyUnserviceableItemID ?? it.PropertyWasteItemID ?? Math.floor(Math.random() * 1000000),
                        dateAcquired: it.DateAcquired || null, // Maps the true history tracking date
                        particulars: it.ItemDescription || inv?.Description || '-',
                        propertyNumber: it.PropertyNumber || inv?.PropertyNumber || '-',
                        quantity: inv?.Quantity ?? 1,
                        unitCost: inv?.UnitCost ? Number(inv.UnitCost) : null,
                        totalCost: inv?.TotalCost ? Number(inv.TotalCost) : null,
                        markedAt: it.marked_at || null,
                        markedBy: it.marked_by_fullname || null,
                    };
                });

                setRows(formattedItems);
            } catch (e) {
                console.error(e);
                toast.error('Failed to load unserviceable items');
                setRows([]);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, []);

    return (
        <div className="min-h-screen p-6 space-y-6 bg-fixed bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold">IIRUP — Inventory & Inspection of Unserviceable Property</h1>
                    <p className="text-sm text-slate-500">All items marked unserviceable (auto-collected from service records)</p>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                {loading ? (
                    <div className="py-8 text-center text-slate-500">Loading unserviceable items...</div>
                ) : !rows || rows.length === 0 ? (
                    <div className="py-8 text-center text-slate-500">
                        <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        No unserviceable items found
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-3">Date Acquired</th>
                                    <th className="px-6 py-3">Particulars / Articles</th>
                                    <th className="px-6 py-3">Property No.</th>
                                    <th className="px-6 py-3">Qty</th>
                                    <th className="px-6 py-3">Unit Cost</th>
                                    <th className="px-6 py-3">Total Cost</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {rows.map((r) => (
                                    <tr key={r.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-3 text-slate-700">
                                            {r.dateAcquired ? format(new Date(r.dateAcquired), 'MMMM dd, yyyy') : '-'}
                                        </td>
                                        <td className="px-6 py-3 text-slate-700">{r.particulars || '-'}</td>
                                        <td className="px-6 py-3 text-slate-700">{r.propertyNumber || '-'}</td>
                                        <td className="px-6 py-3 text-slate-700">{r.quantity ?? '-'}</td>
                                        <td className="px-6 py-3 text-slate-700">
                                            {r.unitCost != null ? `₱${Number(r.unitCost).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                                        </td>
                                        <td className="px-6 py-3 text-slate-700">
                                            {r.totalCost != null ? `₱${Number(r.totalCost).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
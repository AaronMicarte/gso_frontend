'use client';

import { useState } from 'react';
import { useInventory, useIssuance, useGenerateQr } from '@/lib/hooks/useInventory';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';

export function ViewInventoryPage({ baseRoute }: { baseRoute: string }) {
    const params = useParams() as { id?: string };
    const id = Number(params?.id);

    const { data, isLoading } = useInventory(id);
    const generateQr = useGenerateQr();
    const issuance = useIssuance();

    type IssuanceDetail = { inventory_detail_id: number; quantity_issued: number; remarks?: string };
    const [showIssuance, setShowIssuance] = useState(false);
    const [form, setForm] = useState<{ issued_by: number; issued_to: number; issued_to_type: 'department' | 'enduser'; date_issued: string; details: IssuanceDetail[] }>(
        { issued_by: 1, issued_to: 1, issued_to_type: 'department', date_issued: new Date().toISOString().slice(0, 10), details: [] }
    );

    // Guard invalid id early — prevents runtime/TS issues when params are missing
    if (!id || Number.isNaN(id)) {
        return <div className="p-6 text-sm text-red-600">Invalid inventory id</div>;
    }

    const handleGenerateQr = async (detailId: number) => {
        try {
            await generateQr.mutateAsync({ id: detailId });
            toast.success('QR generated');
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to generate QR';
            toast.error(msg);
        }
    };

    const handleOpenIssuance = () => setShowIssuance(true);
    const handleCloseIssuance = () => setShowIssuance(false);

    const handleSubmitIssuance = async () => {
        try {
            const payload = { ...form };
            await issuance.mutateAsync(payload);
            toast.success('Issuance recorded');
            setShowIssuance(false);
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to record issuance';
            toast.error(msg);
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Inventory Details</h1>
                <p className="text-slate-500 text-sm">Inventory and inventory item details</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                {isLoading ? (
                    <div className="text-slate-500">Loading...</div>
                ) : (
                    <>
                        <div className="mb-4">
                            <div className="text-sm text-slate-600">Inventory Number</div>
                            <div className="text-lg font-medium">{data?.InventoryNumber}</div>
                            <div className="text-sm text-slate-500">{data?.Remarks}</div>
                        </div>

                        <div className="mt-6">
                            <h3 className="text-sm font-medium text-slate-700 mb-2">Items</h3>
                            <div className="divide-y divide-slate-200">
                                {data?.details?.length === 0 ? (
                                    <div className="text-slate-500 py-4">No items</div>
                                ) : (
                                    data?.details?.map((d: { InventoryDetailID: number; ItemDescription?: string; Brand?: string; ModelNumber?: string; SerialNumber?: string; propertyType?: { PropertyName: string }; Quantity: number; UnitCost: number; qrCode?: { QRCodeData: string } }) => (
                                        <div key={d.InventoryDetailID} className="py-3 flex items-center justify-between">
                                            <div>
                                                <div className="font-medium">{d.ItemDescription || d.propertyType?.PropertyName || 'Item'}</div>
                                                <div className="text-sm text-slate-500">
                                                    {d.Brand && <span className="mr-2">Brand: {d.Brand}</span>}
                                                    {d.ModelNumber && <span className="mr-2">Model: {d.ModelNumber}</span>}
                                                    {d.SerialNumber && <span className="mr-2">Serial: {d.SerialNumber}</span>}
                                                </div>
                                                <div className="text-sm text-slate-500">Qty: {d.Quantity} • Unit Cost: {d.UnitCost}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {d.qrCode ? (
                                                    <a href={d.qrCode.QRCodeData} target="_blank" rel="noreferrer" className="text-sm text-[var(--primary)]">View QR</a>
                                                ) : (
                                                    <button onClick={() => handleGenerateQr(d.InventoryDetailID)} className="text-sm text-slate-600">Generate QR</button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="mt-6 flex gap-2">
                            <Button onClick={handleOpenIssuance}>Issue Items</Button>
                        </div>
                    </>
                )}
            </div>

            <Dialog
                title="Create Issuance"
                description="Record issuance to a department or end-user"
                open={showIssuance}
                onOpenChange={(open) => setShowIssuance(open)}
                onConfirm={handleSubmitIssuance}
                confirmText="Submit"
                cancelText="Cancel"
                loading={issuance?.status === 'pending'}
            >
                <div className="space-y-4 mt-4">
                    <div>
                        <label className="text-sm text-slate-600">Issued To (Department ID)</label>
                        <input type="number" value={form.issued_to} onChange={(e) => setForm({ ...form, issued_to: Number(e.target.value) })} className="w-full border border-slate-200 rounded p-2" />
                    </div>
                    <div>
                        <label className="text-sm text-slate-600">Date Issued</label>
                        <input type="date" value={form.date_issued} onChange={(e) => setForm({ ...form, date_issued: e.target.value })} className="w-full border border-slate-200 rounded p-2" />
                    </div>
                    <div>
                        <label className="text-sm text-slate-600">Details (InventoryDetailID:Quantity)</label>
                        <textarea rows={4} value={form.details.map(d => d.inventory_detail_id + ':' + d.quantity_issued).join('\n')} onChange={(e) => {
                            const lines = e.target.value.split('\n').map(l => l.trim()).filter(Boolean);
                            const details = lines.map(l => {
                                const [id, qty] = l.split(':').map(s => s.trim());
                                const inventoryId = Number(id);
                                const quantity = Number(qty);
                                return { inventory_detail_id: Number.isFinite(inventoryId) ? inventoryId : 0, quantity_issued: Number.isFinite(quantity) ? quantity : 0 };
                            }).filter(d => d.inventory_detail_id > 0 && d.quantity_issued > 0);
                            setForm({ ...form, details });
                        }} className="w-full border border-slate-200 rounded p-2" />
                        <p className="text-xs text-slate-400 mt-1">Enter one line per item, e.g. <code>123:2</code></p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button onClick={handleCloseIssuance} variant="ghost">Close</Button>
                    </div>
                </div>
            </Dialog>
        </div>
    );
}

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { getIAR } from '@/lib/api/iar';
import { IAR } from '@/types/iar';
import { toast } from 'sonner';

interface ViewIARPageProps {
    baseRoute: string;
}

export function ViewIARPage({ baseRoute }: ViewIARPageProps) {
    const params = useParams();
    const router = useRouter();
    const [iar, setIar] = useState<IAR | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchIAR = async () => {
            try {
                const id = params.id as string;
                if (!id) return;
                const data = await getIAR(parseInt(id));
                setIar(data);
            } catch (error) {
                console.error(error);
                toast.error('Failed to load IAR');
                router.push(`${baseRoute}/inspection-acceptance-reports`);
            } finally {
                setIsLoading(false);
            }
        };

        fetchIAR();
    }, [params.id, baseRoute, router]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
            </div>
        );
    }

    if (!iar) return null;

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href={`${baseRoute}/inspection-acceptance-reports`}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <ArrowLeft className="w-6 h-6 text-slate-600" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">IAR Details</h1>
                        <p className="text-slate-500 text-sm">{iar.IARNumber}</p>
                    </div>
                </div>
                <button
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                    <Printer className="w-4 h-4" />
                    Print
                </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">General Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">IAR Number</label>
                        <p className="mt-1 text-slate-900">{iar.IARNumber}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">DR Number</label>
                        <p className="mt-1 text-slate-900">{iar.deliveryReceipt?.DRNumber}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Date Inspected</label>
                        <p className="mt-1 text-slate-900">
                            {format(toZonedTime(new Date(iar.DateInspected), 'Asia/Manila'), 'PPP')}
                        </p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Inspected By</label>
                        <p className="mt-1 text-slate-900">{iar.inspectedByUser?.FullName}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200">
                    <h2 className="text-lg font-semibold text-slate-900">Inspection Details</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">Item</th>
                                <th className="px-6 py-4">Condition</th>
                                <th className="px-6 py-4 text-right">Accepted</th>
                                <th className="px-6 py-4 text-right">Rejected</th>
                                <th className="px-6 py-4">Remarks</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {iar.details?.map((detail) => (
                                <tr key={detail.IARDetailID}>
                                    <td className="px-6 py-4 text-slate-900">
                                        {detail.drDetail?.ItemDescription}
                                    </td>
                                    <td className="px-6 py-4 text-slate-600">
                                        {detail.condition?.ConditionName}
                                    </td>
                                    <td className="px-6 py-4 text-right text-slate-900">
                                        {detail.QuantityAccepted}
                                    </td>
                                    <td className="px-6 py-4 text-right text-red-600">
                                        {detail.QuantityRejected}
                                    </td>
                                    <td className="px-6 py-4 text-slate-600">
                                        {detail.Remarks || '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

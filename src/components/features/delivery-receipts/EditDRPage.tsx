'use client';

import { useRouter } from 'next/navigation';
import { FileText, Edit } from 'lucide-react';

interface EditDRPageProps {
    baseRoute: '/admin' | '/staff' | '/custodian';
    drId: string;
}

export function EditDRPage({ baseRoute, drId }: EditDRPageProps) {
    const router = useRouter();

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.push(`${baseRoute}/delivery-receipts`)}
                    className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                    ← Back to Delivery Receipts
                </button>
            </div>

            <div className="flex items-center gap-3">
                <div className="p-3 bg-[var(--primary)]/10 rounded-xl">
                    <Edit className="w-6 h-6 text-[var(--primary)]" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Edit Delivery Receipt #{drId}</h1>
                    <p className="text-slate-500 text-sm">Update delivery receipt information</p>
                </div>
            </div>

            {/* Coming Soon Message */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 text-center">
                <FileText className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">DR Edit Form Coming Soon</h3>
                <p className="text-slate-600 mb-4">
                    The Delivery Receipt edit form is under development.
                </p>
                <div className="bg-white rounded-lg p-4 text-left max-w-md mx-auto">
                    <h4 className="font-semibold text-slate-900 mb-2">Edit capabilities:</h4>
                    <ul className="space-y-2 text-sm text-slate-600">
                        <li className="flex items-start gap-2">
                            <span className="text-[var(--primary)] mt-0.5">✓</span>
                            <span>Update DR details</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-[var(--primary)] mt-0.5">✓</span>
                            <span>Modify item quantities and details</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-[var(--primary)] mt-0.5">✓</span>
                            <span>Change status (Admin/Staff only)</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-[var(--primary)] mt-0.5">✓</span>
                            <span>Add/remove items</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-[var(--primary)] mt-0.5">✓</span>
                            <span>Audit trail tracking</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

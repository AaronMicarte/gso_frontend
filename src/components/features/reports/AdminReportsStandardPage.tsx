'use client';

import Link from 'next/link';
import { FileCheck, Truck, FileText } from 'lucide-react';

export default function AdminReportsStandardPage() {
    return (
        <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}>
            <div className="p-6 max-w-6xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Standard Reports</h1>
                        <p className="text-slate-600 text-sm">Official, printable document outputs (DR → PAR/ICS)</p>
                    </div>
                    <Link href="/admin/reports/analytics" className="text-sm text-[var(--primary)] underline">
                        View Analytics
                    </Link>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-1">Official Document Reports</h2>
                    <p className="text-sm text-slate-600">These are the core “reports” matching real-life GSO paperwork.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                        <Link href="/admin/delivery-receipts" className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-3">
                                <Truck className="w-5 h-5 text-slate-700" />
                                <div>
                                    <div className="font-semibold text-slate-900">Delivery Receipts (DR)</div>
                                    <div className="text-sm text-slate-600">View DRs and print DR record summary</div>
                                </div>
                            </div>
                        </Link>

                        <Link href="/admin/issuance/par" className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-3">
                                <FileCheck className="w-5 h-5 text-slate-700" />
                                <div>
                                    <div className="font-semibold text-slate-900">PAR Documents</div>
                                    <div className="text-sm text-slate-600">Printable PAR with acknowledgment signature</div>
                                </div>
                            </div>
                        </Link>

                        <Link href="/admin/issuance/ics" className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-3">
                                <FileText className="w-5 h-5 text-slate-700" />
                                <div>
                                    <div className="font-semibold text-slate-900">ICS Documents</div>
                                    <div className="text-sm text-slate-600">Printable ICS with acknowledgment signature</div>
                                </div>
                            </div>
                        </Link>
                    </div>

                    <div className="mt-5 text-xs text-slate-500">
                        Note: “Automated reporting” means the system can generate these outputs on-demand from stored data (not just manual paperwork).
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-1">Exports</h2>
                    <p className="text-sm text-slate-600">Need summaries (CSV/PDF) for audit and tracking? Use Custom Reports.</p>
                    <div className="mt-4">
                        <Link href="/admin/reports/custom" className="inline-flex items-center px-4 py-2 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90">
                            Go to Custom Reports
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

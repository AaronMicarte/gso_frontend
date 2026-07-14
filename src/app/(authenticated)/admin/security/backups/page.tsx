"use client";

import React, { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { listBackups, createBackup, downloadBackup, deleteBackup } from '@/lib/api/backups';

interface BackupItem {
    path: string;
    name: string;
    size: number;
    modified: number;
    created_by: string;
    status: string;
    created_at: string;
}



const formatDate = (value?: string | number | null): string => {
    if (!value) {
        return '-';
    }

    let date: Date;
    if (typeof value === 'number') {
        date = new Date(value < 1_000_000_000_000 ? value * 1000 : value);
    } else {
        date = new Date(value);
    }

    if (Number.isNaN(date.getTime())) {
        return '-';
    }

    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
};

const formatDateShort = (value?: string | number | null): string => {
    if (!value) {
        return '-';
    }

    let date: Date;
    if (typeof value === 'number') {
        date = new Date(value < 1_000_000_000_000 ? value * 1000 : value);
    } else {
        date = new Date(value);
    }
    if (Number.isNaN(date.getTime())) {
        return '-';
    }

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });
};

const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};



export default function BackupsPage() {
    const [backups, setBackups] = useState<BackupItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const data = await listBackups();
            setBackups(data.data || []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const handleCreate = async () => {
        if (!window.confirm('Create a new database backup now?')) return;
        setBusy(true);
        try {
            await createBackup();
            await load();
            window.alert('Backup created');
        } catch (e: any) {
            window.alert(e?.message || 'Failed to create backup');
        } finally {
            setBusy(false);
        }
    };



    const handleDownload = async (name: string) => {
        setBusy(true);
        try {
            const blob = await downloadBackup(name);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (e: any) {
            window.alert(e?.message || 'Download failed');
        } finally {
            setBusy(false);
        }
    };

    const handleDelete = async (name: string) => {
        if (!window.confirm('Delete this backup?')) return;
        setBusy(true);
        try {
            await deleteBackup(name);
            await load();
            window.alert('Deleted');
        } catch (e: any) {
            window.alert(e?.message || 'Delete failed');
        } finally {
            setBusy(false);
        }
    };



    return (
        <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: 'fixed' }}>
            <div className="p-4 sm:p-6 lg:p-8 space-y-6">
                <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-3xl font-semibold">Database Backups</h1>
                        <p className="mt-1 text-sm text-slate-600">
                            Create and manage database backups. Manually create backups on-demand using the button below.
                        </p>
                    </div>
                    <button
                        className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                        onClick={handleCreate}
                        disabled={busy}
                    >
                        Create Backup
                    </button>
                </div>





                {loading ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-700 shadow-sm">Loading backups...</div>
                ) : (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <table className="w-full border-collapse text-left">
                            <thead className="bg-slate-100">
                                <tr>
                                    <th className="px-4 py-3 text-sm font-semibold text-slate-700">Filename</th>
                                    <th className="px-4 py-3 text-sm font-semibold text-slate-700">Date</th>
                                    <th className="px-4 py-3 text-sm font-semibold text-slate-700">Size</th>
                                    <th className="px-4 py-3 text-sm font-semibold text-slate-700">Created By</th>
                                    <th className="px-4 py-3 text-sm font-semibold text-slate-700">Status</th>
                                    <th className="px-4 py-3 text-sm font-semibold text-slate-700">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {backups.map((backup) => (
                                    <tr key={backup.path} className="border-t border-slate-200">
                                        <td className="px-4 py-4 text-sm text-slate-800">{backup.name}</td>
                                        <td className="px-4 py-4 text-sm text-slate-800">{formatDate(backup.created_at)}</td>

                                        <td className="px-4 py-4 text-sm text-slate-800">{formatFileSize(backup.size || 0)}</td>
                                        <td className="px-4 py-4 text-sm text-slate-800">{backup.created_by}</td>
                                        <td className="px-4 py-4 text-sm text-slate-800">
                                            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                                                <CheckCircle2 className="h-4 w-4" />
                                                {backup.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-sm">
                                            <button
                                                className="mr-2 inline-flex items-center rounded-lg bg-green-600 px-3 py-1.5 text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                                                onClick={() => handleDownload(backup.name)}
                                                disabled={busy}
                                            >
                                                Download
                                            </button>
                                            <button
                                                className="inline-flex items-center rounded-lg bg-red-600 px-3 py-1.5 text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                                                onClick={() => handleDelete(backup.name)}
                                                disabled={busy}
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {backups.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                                            No backups found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>

    );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Dialog } from '@/components/ui/Dialog';
import { adminGetUsers, adminResendActivation, adminToggleUserActive, adminToggleUserMfa } from '@/lib/api/admin/users';
import type { AdminUserRow } from '@/types/users';
import Link from 'next/link';
import { Search, Plus, Filter, ShieldCheck, ShieldAlert, KeyRound, CheckCircle2 } from 'lucide-react';

export default function AdminUsersListPage() {
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<AdminUserRow[]>([]);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [departmentFilter, setDepartmentFilter] = useState<string>('all');

    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmLoading, setConfirmLoading] = useState(false);
    const [confirmUser, setConfirmUser] = useState<AdminUserRow | null>(null);

    const [mfaConfirmOpen, setMfaConfirmOpen] = useState(false);
    const [mfaConfirmLoading, setMfaConfirmLoading] = useState(false);
    const [mfaConfirmUser, setMfaConfirmUser] = useState<AdminUserRow | null>(null);

    async function load() {
        setLoading(true);
        try {
            const data = await adminGetUsers(search.trim() || undefined);
            setRows(data);
        } catch (e) {
            toast.error('Failed to load users', {
                description: e instanceof Error ? e.message : 'Unknown error',
            });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const availableRoles = useMemo(() => {
        const set = new Set<string>();
        rows.forEach((r) => {
            if (r.Role) set.add(r.Role);
        });
        return Array.from(set);
    }, [rows]);

    const availableDepartments = useMemo(() => {
        const set = new Set<string>();
        rows.forEach((r) => {
            if (r.Department) set.add(r.Department);
        });
        return Array.from(set);
    }, [rows]);

    const filtered = useMemo(() => {
        return rows.filter((u) => {
            // Search query
            const q = search.trim().toLowerCase();
            if (q) {
                const matchesSearch = [u.Username, u.Email, u.FullName ?? '', u.Role ?? '', u.Department ?? '']
                    .join(' ')
                    .toLowerCase()
                    .includes(q);
                if (!matchesSearch) return false;
            }

            // Role filter
            if (roleFilter !== 'all' && u.Role !== roleFilter) {
                return false;
            }

            // Department filter
            if (departmentFilter !== 'all' && u.Department !== departmentFilter) {
                return false;
            }

            // Status filter
            if (statusFilter === 'pending_password') {
                return (u.MustChangePassword ?? false) === true;
            }
            if (statusFilter === 'pending_mfa') {
                return !(u.MustChangePassword ?? false) && !u.MFAEnabled;
            }
            if (statusFilter === 'fully_setup') {
                return !(u.MustChangePassword ?? false) && u.MFAEnabled;
            }
            if (statusFilter === 'active') {
                return u.IsActive;
            }
            if (statusFilter === 'disabled') {
                return !u.IsActive;
            }

            return true;
        });
    }, [rows, search, roleFilter, departmentFilter, statusFilter]);

    function openToggleDialog(user: AdminUserRow) {
        setConfirmUser(user);
        setConfirmOpen(true);
    }

    async function onConfirmToggle() {
        if (!confirmUser) return;

        setConfirmLoading(true);
        try {
            await adminToggleUserActive(confirmUser.UserID, !confirmUser.IsActive);
            toast.success('User updated', {
                description: `${confirmUser.Username} is now ${!confirmUser.IsActive ? 'Active' : 'Disabled'}.`,
            });
            setConfirmOpen(false);
            setConfirmUser(null);
            await load();
        } catch (e) {
            toast.error('Failed to update user', {
                description: e instanceof Error ? e.message : 'Unknown error',
            });
        } finally {
            setConfirmLoading(false);
        }
    }

    function openMfaToggleDialog(user: AdminUserRow) {
        setMfaConfirmUser(user);
        setMfaConfirmOpen(true);
    }

    async function onConfirmMfaToggle() {
        if (!mfaConfirmUser) return;

        setMfaConfirmLoading(true);
        try {
            await adminToggleUserMfa(mfaConfirmUser.UserID, !mfaConfirmUser.MFAEnabled);
            toast.success('MFA updated', {
                description: `${mfaConfirmUser.Username} MFA is now ${!mfaConfirmUser.MFAEnabled ? 'Enabled' : 'Disabled'}.`,
            });
            setMfaConfirmOpen(false);
            setMfaConfirmUser(null);
            await load();
        } catch (e) {
            toast.error('Failed to update MFA', {
                description: e instanceof Error ? e.message : 'Unknown error',
            });
        } finally {
            setMfaConfirmLoading(false);
        }
    }

    async function onResendActivation(user: AdminUserRow) {
        try {
            const res = await adminResendActivation(user.UserID);
            toast.success('Activation sent', {
                description: res.email_sent
                    ? `Sent to ${user.Email}`
                    : 'Mail not configured. Activation link copied for manual sending.',
            });

            if (!res.email_sent && res.activation_link) {
                await navigator.clipboard.writeText(res.activation_link);
            }

            await load();
        } catch (e) {
            toast.error('Failed to resend activation', {
                description: e instanceof Error ? e.message : 'Unknown error',
            });
        }
    }

    function renderOnboardingStatus(u: AdminUserRow) {
        if (!u.IsActive) {
            return (
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-rose-100 text-rose-700 border border-rose-200">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                    Account Disabled
                </span>
            );
        }

        if (u.MustChangePassword) {
            return (
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                    <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                    Pending Password Change (Default: 123)
                </span>
            );
        }

        if (!u.MFAEnabled) {
            return (
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-300">
                    <ShieldAlert className="w-3.5 h-3.5 text-sky-600" />
                    Pending 2FA QR Scan
                </span>
            );
        }

        return (
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Fully Setup & Verified (2FA Ready)
            </span>
        );
    }

    return (
        <div
            className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}
        >
            <div className="p-4 sm:p-6 lg:p-8 space-y-6">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Users</h1>
                        <p className="text-sm text-slate-500">
                            Manage users, monitor onboarding/2FA status, and control user access.
                        </p>
                    </div>
                    <Link href="/admin/users/create" className="shrink-0">
                        <button className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors">
                            <Plus className="w-4 h-4" />
                            Create User
                        </button>
                    </Link>
                </div>

                {/* Filter and Search Bar */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by username, email, role, department..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 text-sm"
                            />
                        </div>

                        {/* Status Filter */}
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-slate-500 shrink-0" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            >
                                <option value="all">All Onboarding Statuses</option>
                                <option value="pending_password">Pending Password Change</option>
                                <option value="pending_mfa">Pending 2FA QR Scan</option>
                                <option value="fully_setup">Fully Setup & Verified</option>
                                <option value="active">Active Only</option>
                                <option value="disabled">Disabled Only</option>
                            </select>
                        </div>

                        {/* Role Filter */}
                        {availableRoles.length > 0 && (
                            <select
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value)}
                                className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            >
                                <option value="all">All Roles</option>
                                {availableRoles.map((r) => (
                                    <option key={r} value={r}>
                                        {r}
                                    </option>
                                ))}
                            </select>
                        )}

                        {/* Department Filter */}
                        {availableDepartments.length > 0 && (
                            <select
                                value={departmentFilter}
                                onChange={(e) => setDepartmentFilter(e.target.value)}
                                className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            >
                                <option value="all">All Departments</option>
                                {availableDepartments.map((d) => (
                                    <option key={d} value={d}>
                                        {d}
                                    </option>
                                ))}
                            </select>
                        )}

                        <button
                            type="button"
                            disabled={loading}
                            onClick={() => void load()}
                            className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm disabled:opacity-50"
                        >
                            Refresh
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 text-slate-700">
                                <tr>
                                    <th className="text-left font-semibold px-4 py-3">User</th>
                                    <th className="text-left font-semibold px-4 py-3">Role</th>
                                    <th className="text-left font-semibold px-4 py-3">Department</th>
                                    <th className="text-left font-semibold px-4 py-3">Onboarding & Security Status</th>
                                    <th className="text-left font-semibold px-4 py-3">2FA Authenticator</th>
                                    <th className="text-center font-semibold px-4 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td className="px-4 py-4 text-slate-600" colSpan={6}>
                                            No users match the selected filters.
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((u) => (
                                        <tr key={u.UserID} className="hover:bg-slate-50">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-slate-900">{u.FullName || u.Username}</div>
                                                <div className="text-xs text-slate-600">{u.Email}</div>
                                                <div className="text-xs text-slate-500">@{u.Username}</div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-700">{u.Role || '—'}</td>
                                            <td className="px-4 py-3 text-slate-700">{u.Department || '—'}</td>
                                            <td className="px-4 py-3">
                                                {renderOnboardingStatus(u)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <ShieldCheck className={`w-4 h-4 ${u.MFAEnabled ? 'text-emerald-600' : 'text-slate-400'}`} />
                                                    <span className="text-xs text-slate-600">{u.MFAEnabled ? 'Enabled' : 'Disabled'}</span>
                                                    <button
                                                        type="button"
                                                        role="switch"
                                                        aria-checked={u.MFAEnabled}
                                                        aria-label={`Toggle MFA for ${u.Username}`}
                                                        onClick={() => openMfaToggleDialog(u)}
                                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-1 ${u.MFAEnabled ? 'bg-emerald-500' : 'bg-slate-300'
                                                            }`}
                                                    >
                                                        <span
                                                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${u.MFAEnabled ? 'translate-x-4.5' : 'translate-x-0.5'
                                                                }`}
                                                        />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex justify-end gap-2">
                                                    {!u.EmailVerifiedAt && (
                                                        <button
                                                            className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs"
                                                            onClick={() => void onResendActivation(u)}
                                                        >
                                                            Resend Activation
                                                        </button>
                                                    )}
                                                    <Link href={`/admin/users/${u.UserID}/edit`}>
                                                        <button className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs">
                                                            Edit
                                                        </button>
                                                    </Link>
                                                    <button
                                                        className={`px-3 py-2 rounded-lg border text-xs font-medium ${u.IsActive
                                                            ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
                                                            : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                                                            }`}
                                                        onClick={() => openToggleDialog(u)}
                                                    >
                                                        {u.IsActive ? 'Disable' : 'Enable'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                <Dialog
                    title={confirmUser?.IsActive ? 'Disable user?' : 'Enable user?'}
                    description={
                        confirmUser
                            ? `This will ${confirmUser.IsActive ? 'disable' : 'enable'} ${confirmUser.Username}.`
                            : undefined
                    }
                    open={confirmOpen}
                    onOpenChange={setConfirmOpen}
                    onConfirm={() => void onConfirmToggle()}
                    confirmText={confirmUser?.IsActive ? 'Disable' : 'Enable'}
                    loading={confirmLoading}
                />
                <Dialog
                    title={mfaConfirmUser?.MFAEnabled ? 'Disable MFA?' : 'Enable MFA?'}
                    description={
                        mfaConfirmUser
                            ? `This will ${mfaConfirmUser.MFAEnabled ? 'disable' : 'enable'} MFA for ${mfaConfirmUser.Username}.`
                            : undefined
                    }
                    open={mfaConfirmOpen}
                    onOpenChange={setMfaConfirmOpen}
                    onConfirm={() => void onConfirmMfaToggle()}
                    confirmText={mfaConfirmUser?.MFAEnabled ? 'Disable MFA' : 'Enable MFA'}
                    loading={mfaConfirmLoading}
                />
            </div>
        </div>
    );
}

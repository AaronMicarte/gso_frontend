'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { adminGetUser, adminUpdateUser } from '@/lib/api/admin/users';
import { getAllDepartments } from '@/lib/api/masterData/departments';
import { getAllUserRoles } from '@/lib/api/masterData/userRoles';
import type { Department, UserRole } from '@/types/masterData';

interface AdminUsersEditPageProps {
    userId: number;
}

export default function AdminUsersEditPage({ userId }: AdminUsersEditPageProps) {
    const router = useRouter();

    const [loading, setLoading] = useState(false);
    const [bootLoading, setBootLoading] = useState(true);

    const [departments, setDepartments] = useState<Department[]>([]);
    const [roles, setRoles] = useState<UserRole[]>([]);

    const [initialEmail, setInitialEmail] = useState('');
    const [Username, setUsername] = useState('');
    const [Email, setEmail] = useState('');
    const [FullName, setFullName] = useState('');
    const [DepartmentID, setDepartmentId] = useState<number | ''>('');
    const [UserRoleID, setUserRoleId] = useState<number | ''>('');
    const [IsActive, setIsActive] = useState(true);
    const [ResetPasswordToDefault, setResetPasswordToDefault] = useState(false);

    useEffect(() => {
        async function boot() {
            setBootLoading(true);
            try {
                const [dept, role, user] = await Promise.all([
                    getAllDepartments(),
                    getAllUserRoles(),
                    adminGetUser(userId),
                ]);

                setDepartments(dept);
                setRoles(role);

                setUsername(user.Username ?? '');
                setEmail(user.Email ?? '');
                setInitialEmail(user.Email ?? '');
                setFullName(user.FullName ?? '');
                setDepartmentId(user.DepartmentID || '');
                setUserRoleId(user.UserRoleID || '');
                setIsActive(!!user.IsActive);
            } catch (e) {
                toast.error('Failed to load user data', {
                    description: e instanceof Error ? e.message : 'Unknown error',
                });
                router.push('/admin/users');
            } finally {
                setBootLoading(false);
            }
        }

        void boot();
    }, [router, userId]);

    const roleOptions = useMemo(() => {
        const seen = new Set<number>();
        const normalized: Array<{ id: number; label: string }> = [];

        for (const role of roles) {
            const r = role as unknown as Record<string, unknown>;
            const rawId = r.id ?? r.UserRoleID ?? r.RoleID;
            const rawName = r.name ?? r.RoleName ?? r.Name;

            const id = typeof rawId === 'number' ? rawId : Number(rawId);
            if (!Number.isFinite(id)) continue;

            const label = typeof rawName === 'string' && rawName.trim().length > 0 ? rawName.trim() : `Role ${id}`;

            if (seen.has(id)) continue;
            seen.add(id);
            normalized.push({ id, label });
        }

        return normalized;
    }, [roles]);

    const departmentOptions = useMemo(() => {
        const seen = new Set<number>();
        const normalized: Array<{ id: number; label: string }> = [];

        for (const dept of departments) {
            const d = dept as unknown as Record<string, unknown>;
            const rawId = d.id ?? d.DepartmentID ?? d.DeptID;
            const rawName = d.name ?? d.DepartmentName ?? d.department_name ?? d.Name;

            const id = typeof rawId === 'number' ? rawId : Number(rawId);
            if (!Number.isFinite(id) || id <= 0) continue;

            const label =
                typeof rawName === 'string' && rawName.trim().length > 0 ? rawName.trim() : `Department ${id}`;

            if (seen.has(id)) continue;
            seen.add(id);
            normalized.push({ id, label });
        }

        return normalized;
    }, [departments]);

    const emailChanged = useMemo(() => {
        return initialEmail.trim().toLowerCase() !== Email.trim().toLowerCase();
    }, [Email, initialEmail]);

    const canSubmit = useMemo(() => {
        return (
            !bootLoading &&
            Username.trim().length >= 3 &&
            Email.trim().length > 0 &&
            typeof DepartmentID === 'number' &&
            Number.isFinite(DepartmentID) &&
            DepartmentID > 0 &&
            typeof UserRoleID === 'number' &&
            Number.isFinite(UserRoleID) &&
            UserRoleID > 0
        );
    }, [bootLoading, Username, Email, DepartmentID, UserRoleID]);

    async function onSubmit() {
        if (!canSubmit) return;

        const deptId = typeof DepartmentID === 'number' ? DepartmentID : NaN;
        const roleId = typeof UserRoleID === 'number' ? UserRoleID : NaN;
        if (!Number.isFinite(deptId) || deptId <= 0 || !Number.isFinite(roleId) || roleId <= 0) {
            toast.error('Invalid form selection', {
                description: 'Please re-select Role and Department.',
            });
            return;
        }

        setLoading(true);
        try {
            const res = await adminUpdateUser(userId, {
                Username: Username.trim(),
                Email: Email.trim(),
                FullName: FullName.trim() ? FullName.trim() : undefined,
                UserRoleID: roleId,
                DepartmentID: deptId,
                IsActive,
                ResetPasswordToDefault,
            });

            const notes: string[] = [];
            if (res.password_reset_required) notes.push('Password reset to 123 and user must change it at next login.');
            if (res.mfa_reset_required) notes.push('MFA reset due to email change; user must set up a new TOTP QR.');

            toast.success('User updated', {
                description: notes.length > 0 ? notes.join(' ') : 'Changes saved successfully.',
            });

            router.push('/admin/users');
        } catch (e: unknown) {
            const err = e as {
                response?: {
                    data?: {
                        message?: string;
                        errors?: Record<string, string[]>;
                    };
                };
                message?: string;
            };

            const backendMessage = err.response?.data?.message;
            const backendErrors = err.response?.data?.errors;
            const firstFieldError = backendErrors
                ? Object.values(backendErrors).flat().find((m) => typeof m === 'string' && m.trim().length > 0)
                : undefined;

            toast.error('Failed to update user', {
                description:
                    backendMessage ||
                    firstFieldError ||
                    (typeof err.message === 'string' ? err.message : 'Please check the form and try again.'),
            });
        } finally {
            setLoading(false);
        }
    }

    return (
        <div
            className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: 'fixed' }}
        >
            <div className="p-4 sm:p-6 lg:p-8 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Edit User</h1>
                    <p className="text-sm text-slate-600">
                        Update account profile, access, and security controls.
                    </p>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4 max-w-3xl">
                    <Input
                        label="Username"
                        placeholder="e.g. juan.dela.cruz"
                        value={Username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={bootLoading}
                    />

                    <Input
                        label="Email"
                        placeholder="e.g. juan.delacruz@elsalvador.gov.ph"
                        value={Email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={bootLoading}
                    />

                    {emailChanged && (
                        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                            Email was changed. On save, this user&apos;s MFA will be reset and a new QR setup will be required.
                        </div>
                    )}

                    <Input
                        label="Full name (optional)"
                        placeholder="e.g. Juan Dela Cruz"
                        value={FullName}
                        onChange={(e) => setFullName(e.target.value)}
                        disabled={bootLoading}
                    />

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                        <select
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                            value={UserRoleID}
                            onChange={(e) => setUserRoleId(e.target.value ? Number(e.target.value) : '')}
                            disabled={bootLoading}
                        >
                            <option value="">Select role</option>
                            {roleOptions.map((r) => (
                                <option key={`role-${r.id}`} value={r.id}>
                                    {r.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                        <select
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                            value={DepartmentID}
                            onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : '')}
                            disabled={bootLoading}
                        >
                            <option value="">Select department</option>
                            {departmentOptions.map((d) => (
                                <option key={`dept-${d.id}`} value={d.id}>
                                    {d.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                            type="checkbox"
                            checked={IsActive}
                            onChange={(e) => setIsActive(e.target.checked)}
                            disabled={bootLoading}
                        />
                        Account is active
                    </label>

                    <label className="flex items-start gap-2 text-sm text-slate-700">
                        <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={ResetPasswordToDefault}
                            onChange={(e) => setResetPasswordToDefault(e.target.checked)}
                            disabled={bootLoading}
                        />
                        <span>
                            Reset password to <span className="font-semibold">123</span> and require user to change it on next login
                        </span>
                    </label>

                    <div className="pt-2 flex gap-2">
                        <Button type="button" disabled={!canSubmit || loading} onClick={() => void onSubmit()}>
                            {loading ? 'Saving...' : 'Save Changes'}
                        </Button>
                        <button
                            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                            type="button"
                            onClick={() => router.push('/admin/users')}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

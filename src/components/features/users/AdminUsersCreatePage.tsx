'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { adminCreateUser } from '@/lib/api/admin/users';
import { getAllDepartments } from '@/lib/api/masterData/departments';
import { getAllUserRoles } from '@/lib/api/masterData/userRoles';
import type { Department, UserRole } from '@/types/masterData';

export default function AdminUsersCreatePage() {
    const router = useRouter();

    const [loading, setLoading] = useState(false);
    const [bootLoading, setBootLoading] = useState(true);

    const [departments, setDepartments] = useState<Department[]>([]);
    const [roles, setRoles] = useState<UserRole[]>([]);

    const [Username, setUsername] = useState('');
    const [Email, setEmail] = useState('');
    const [FullName, setFullName] = useState('');
    const [DepartmentID, setDepartmentId] = useState<number | ''>('');
    const [UserRoleID, setUserRoleId] = useState<number | ''>('');

    useEffect(() => {
        async function boot() {
            setBootLoading(true);
            try {
                const [dept, role] = await Promise.all([getAllDepartments(), getAllUserRoles()]);
                setDepartments(dept);
                setRoles(role);
            } catch (e) {
                toast.error('Failed to load master data', {
                    description: e instanceof Error ? e.message : 'Unknown error',
                });
            } finally {
                setBootLoading(false);
            }
        }

        void boot();
    }, []);

    const canSubmit = useMemo(() => {
        return (
            Username.trim().length >= 3 &&
            Email.trim().length > 0 &&
            typeof DepartmentID === 'number' &&
            typeof UserRoleID === 'number'
        );
    }, [Username, Email, DepartmentID, UserRoleID]);

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
        return departments.map((dept) => ({
            id: dept.id,
            label: dept.name,
        }));
    }, [departments]);

    async function onSubmit() {
        if (!canSubmit) return;

        setLoading(true);
        try {
            const res = await adminCreateUser({
                Username: Username.trim(),
                Email: Email.trim(),
                FullName: FullName.trim() ? FullName.trim() : undefined,
                DepartmentID: DepartmentID as number,
                UserRoleID: UserRoleID as number,
            });

            toast.success('User created', {
                description: res.email_sent
                    ? `Activation email sent to ${res.user.Email}`
                    : 'Mail not configured. Activation link copied for manual sending.',
            });

            if (!res.email_sent && res.activation_link) {
                await navigator.clipboard.writeText(res.activation_link);
            }

            router.push('/admin/users');
        } catch (e) {
            toast.error('Failed to create user', {
                description: e instanceof Error ? e.message : 'Unknown error',
            });
        } finally {
            setLoading(false);
        }
    }

    return (
        <div
            className="min-h-screen bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: "url('/assets/images/background/bg.jpg')" }}
        >
            <div className="p-4 sm:p-6 lg:p-8 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Create User</h1>
                    <p className="text-sm text-slate-600">
                        Default temporary password is <span className="font-semibold">123</span>. The user will set a
                        new password during activation.
                    </p>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4 max-w-3xl">
                    <Input
                        label="Username"
                        placeholder="e.g. juan.dela.cruz"
                        value={Username}
                        onChange={(e) => setUsername(e.target.value)}
                    />

                    <Input
                        label="Email"
                        placeholder="e.g. juan.delacruz@elsalvador.gov.ph"
                        value={Email}
                        onChange={(e) => setEmail(e.target.value)}
                    />

                    <Input
                        label="Full name (optional)"
                        placeholder="e.g. Juan Dela Cruz"
                        value={FullName}
                        onChange={(e) => setFullName(e.target.value)}
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

                    <div className="pt-2 flex gap-2">
                        <Button type="button" disabled={!canSubmit || loading} onClick={() => void onSubmit()}>
                            {loading ? 'Creating...' : 'Create User'}
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

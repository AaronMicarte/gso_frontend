'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { changeTemporaryPassword } from '@/lib/auth';

export default function ChangeTemporaryPasswordPage() {
    const router = useRouter();
    const params = useSearchParams();
    const username = (params.get('username') ?? '').trim();

    const [currentPassword, setCurrentPassword] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const passwordChecks = useMemo(() => {
        const hasLower = /[a-z]/.test(password);
        const hasUpper = /[A-Z]/.test(password);
        const hasNumber = /\d/.test(password);
        const hasSymbol = /[^A-Za-z0-9]/.test(password);
        const hasMinLength = password.length >= 12;

        return {
            hasMinLength,
            hasLower,
            hasUpper,
            hasNumber,
            hasSymbol,
            isStrong: hasMinLength && hasLower && hasUpper && hasNumber && hasSymbol,
        };
    }, [password]);

    const passwordError = useMemo(() => {
        if (password.length === 0) return undefined;
        if (passwordChecks.isStrong) return undefined;
        return 'Password must meet all requirements below.';
    }, [password, passwordChecks.isStrong]);

    const confirmPasswordError = useMemo(() => {
        if (confirmPassword.length === 0) return undefined;
        if (password === confirmPassword) return undefined;
        return 'Passwords do not match.';
    }, [password, confirmPassword]);

    const canSubmit = useMemo(() => {
        return (
            username.length > 0 &&
            currentPassword.length > 0 &&
            passwordChecks.isStrong &&
            password.length > 0 &&
            password === confirmPassword
        );
    }, [username, currentPassword, passwordChecks.isStrong, password, confirmPassword]);

    function describeValidationError(err: unknown): string {
        if (!(err instanceof AxiosError)) return 'Failed to update password.';
        const status = err.response?.status;
        const data = err.response?.data as
            | {
                message?: string;
                errors?: Record<string, string[]>;
            }
            | undefined;

        if (status === 401) return data?.message || 'Invalid username or current password.';

        if (status === 422) {
            const firstNewPassword = data?.errors?.new_password?.[0];
            const firstConfirmation = data?.errors?.new_password_confirmation?.[0];
            const firstCurrent = data?.errors?.current_password?.[0];
            return firstNewPassword || firstConfirmation || firstCurrent || data?.message || 'Validation failed.';
        }

        return data?.message || 'Failed to update password.';
    }

    async function onSubmit() {
        if (!canSubmit) return;

        setLoading(true);
        try {
            await changeTemporaryPassword({
                username,
                current_password: currentPassword,
                new_password: password,
                new_password_confirmation: confirmPassword,
            });

            toast.success('Password updated', {
                description: 'Login using your new password.',
            });

            router.push('/');
        } catch (e) {
            toast.error('Password update failed', {
                description: describeValidationError(e),
            });
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-3">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">Change Temporary Password</h1>
                    <p className="text-sm text-slate-600">
                        Use your temporary password (123) first, then set a strong new password.
                    </p>
                </div>

                {!username && (
                    <div className="p-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm">
                        Missing username. Please return to login and try again.
                    </div>
                )}

                <Input label="Username" value={username} disabled />

                <Input
                    label="Current Password"
                    type="password"
                    placeholder="Enter temporary password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                />

                <Input
                    label="New Password"
                    type="password"
                    placeholder="12+ chars with upper/lower/number/symbol"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    error={passwordError}
                />

                <div className="-mt-2 mb-3 text-xs">
                    <div className="font-medium text-slate-700 mb-1">Password requirements</div>
                    <ul className="space-y-1">
                        <li className={passwordChecks.hasMinLength ? 'text-emerald-700' : 'text-slate-600'}>
                            At least 12 characters
                        </li>
                        <li className={passwordChecks.hasUpper ? 'text-emerald-700' : 'text-slate-600'}>
                            At least 1 uppercase letter (A-Z)
                        </li>
                        <li className={passwordChecks.hasLower ? 'text-emerald-700' : 'text-slate-600'}>
                            At least 1 lowercase letter (a-z)
                        </li>
                        <li className={passwordChecks.hasNumber ? 'text-emerald-700' : 'text-slate-600'}>
                            At least 1 number (0-9)
                        </li>
                        <li className={passwordChecks.hasSymbol ? 'text-emerald-700' : 'text-slate-600'}>
                            At least 1 symbol (example: !@#$)
                        </li>
                    </ul>
                </div>

                <Input
                    label="Confirm New Password"
                    type="password"
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    error={confirmPasswordError}
                />

                <div className="pt-2">
                    <Button type="button" disabled={!canSubmit || loading} onClick={() => void onSubmit()}>
                        {loading ? 'Updating...' : 'Update Password'}
                    </Button>
                </div>
            </div>
        </div>
    );
}

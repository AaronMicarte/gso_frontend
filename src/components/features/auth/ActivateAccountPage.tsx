'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { activateAccount } from '@/lib/api/authActivation';
import { TurnstileWidget } from '@/components/auth/TurnstileWidget';
import { isTurnstileEnabled } from '@/lib/turnstile';

export default function ActivateAccountPage() {
    const turnstileEnabled = isTurnstileEnabled();
    const router = useRouter();
    const params = useSearchParams();
    const token = params.get('token') ?? '';

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [captchaToken, setCaptchaToken] = useState<string | null>(null);
    const [captchaRefreshKey, setCaptchaRefreshKey] = useState(0);
    const [loading, setLoading] = useState(false);

    const passwordChecks = useMemo(() => {
        const hasLower = /[a-z]/.test(password);
        const hasUpper = /[A-Z]/.test(password);
        const hasNumber = /\d/.test(password);
        // Anything not a letter or number counts as a symbol
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
        return token.length > 0 && passwordChecks.isStrong && password === confirmPassword && (!turnstileEnabled || !!captchaToken);
    }, [token, passwordChecks.isStrong, password, confirmPassword, captchaToken, turnstileEnabled]);

    function describeValidationError(err: unknown): string {
        if (!(err instanceof AxiosError)) return 'Invalid or expired activation link.';
        if (err.response?.status !== 422) return 'Invalid or expired activation link.';

        const data = err.response.data as
            | {
                message?: string;
                errors?: Record<string, string[]>;
            }
            | undefined;

        const firstPasswordError = data?.errors?.password?.[0];
        const firstTokenError = data?.errors?.token?.[0];
        const firstConfirmError = data?.errors?.password_confirmation?.[0];

        return (
            firstPasswordError ||
            firstConfirmError ||
            firstTokenError ||
            data?.message ||
            'Validation failed.'
        );
    }

    async function onSubmit() {
        if (!canSubmit) return;

        setLoading(true);
        try {
            const res = await activateAccount({
                token,
                password,
                password_confirmation: confirmPassword,
                turnstile_token: turnstileEnabled ? (captchaToken ?? '') : '',
            });

            toast.success('Account activated', {
                description: 'Please continue to MFA setup / login.',
            });

            // If MFA setup is required, send user to setup with the user id
            if (res.mfa_setup_required) {
                sessionStorage.setItem(
                    'mfa_setup_pending',
                    JSON.stringify({
                        userId: res.user_id,
                        userRole: 'User',
                    })
                );
                router.push('/setup-mfa');
                return;
            }

            // If MFA is already enabled, the user can login and verify
            router.push('/');
        } catch (e) {
            toast.error('Activation failed', {
                description: describeValidationError(e),
            });
        } finally {
            setLoading(false);
            setCaptchaRefreshKey((prev) => prev + 1);
            setCaptchaToken(null);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-3">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">Activate Account</h1>
                    <p className="text-sm text-slate-600">
                        Set your new password to activate your account.
                    </p>
                </div>

                {!token && (
                    <div className="p-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm">
                        Invalid activation link.
                    </div>
                )}

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
                    label="Confirm Password"
                    type="password"
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    error={confirmPasswordError}
                />

                <TurnstileWidget
                    onTokenChange={setCaptchaToken}
                    theme="light"
                    refreshKey={captchaRefreshKey}
                    className="pt-2"
                />

                <div className="pt-2">
                    <Button type="button" disabled={!canSubmit || loading} onClick={() => void onSubmit()}>
                        {loading ? 'Activating...' : 'Activate'}
                    </Button>
                </div>

                <div className="text-xs text-slate-500">
                    After activation, you may be asked to set up MFA depending on your role.
                </div>
            </div>
        </div>
    );
}

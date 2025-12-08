'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Image from 'next/image';
import { Shield, Loader2, AlertTriangle, Smartphone, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { verifyMFACode } from '@/lib/api/mfa';
import { toast } from 'sonner';

const codeSchema = z.object({
    code: z.string().min(6, 'Enter at least 6 characters').max(8, 'Code too long'),
    trust_device: z.boolean().optional(),
});

type CodeFormData = z.infer<typeof codeSchema>;

interface PendingMFA {
    userId: number;
    userName: string;
    userRole: string;
}

export default function VerifyMFAPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [useBackupCode, setUseBackupCode] = useState(false);
    const [pending, setPending] = useState<PendingMFA | null>(null);

    const form = useForm<CodeFormData>({
        resolver: zodResolver(codeSchema),
        defaultValues: { code: '', trust_device: false },
    });

    useEffect(() => {
        const stored = sessionStorage.getItem('mfa_verify_pending');
        if (!stored) {
            router.replace('/');
            return;
        }
        setPending(JSON.parse(stored));
    }, [router]);

    const getDashboardRoute = (role: string): string => {
        const r = role.toLowerCase();
        if (r === 'admin') return '/admin/dashboard';
        if (r === 'gso staff') return '/staff/dashboard';
        if (r === 'property custodian') return '/custodian/dashboard';
        if (r === 'department head') return '/department/dashboard';
        return '/user/dashboard';
    };

    const handleSubmit = async (data: CodeFormData) => {
        if (!pending) return;

        try {
            setLoading(true);
            setError(null);

            const response = await verifyMFACode({
                user_id: pending.userId,
                code: data.code.toUpperCase().replace(/\s/g, ''),
                trust_device: data.trust_device,
            });

            sessionStorage.removeItem('mfa_verify_pending');
            toast.success('Login successful!', {
                description: `Welcome back, ${response.user.FullName || response.user.Username}!`,
            });
            router.replace(getDashboardRoute(response.user.Role));
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Invalid code. Please try again.');
            form.setValue('code', '');
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        sessionStorage.removeItem('mfa_verify_pending');
        router.replace('/');
    };

    if (!pending) {
        return (
            <div className="min-h-screen flex relative">
                <div className="absolute inset-0 z-0">
                    <Image
                        src="/assets/images/login/elsal bg.jpg"
                        alt="El Salvador Background"
                        fill
                        className="object-cover"
                        priority
                    />
                    <div className="absolute inset-0 bg-black/40"></div>
                </div>
                <div className="w-full flex items-center justify-center p-8 min-h-screen relative z-10">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex relative">
            {/* Background Image */}
            <div className="absolute inset-0 z-0">
                <Image
                    src="/assets/images/login/elsal bg.jpg"
                    alt="El Salvador Background"
                    fill
                    className="object-cover"
                    priority
                />
                <div className="absolute inset-0 bg-black/40"></div>
            </div>

            {/* Centered Container - Wide layout */}
            <div className="w-full flex items-center justify-center p-3 sm:p-6 min-h-screen relative z-10">
                <div className="w-full bg-slate-800/95 backdrop-blur-sm rounded-xl shadow-2xl border border-slate-700 p-6 sm:p-8 max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="text-center mb-6">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-500/20 mb-3">
                            <Shield className="w-7 h-7 text-blue-400" />
                        </div>
                        <h1 className="text-xl font-bold text-white">Verify Your Identity</h1>
                        <p className="text-slate-400 mt-0.5 text-sm">Hi, {pending.userName}</p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg mb-4 flex items-center gap-2 text-xs">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* Instructions */}
                    <div className="bg-slate-900/50 rounded-lg p-3 mb-4">
                        <div className="flex items-start gap-2">
                            {useBackupCode ? (
                                <KeyRound className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                            ) : (
                                <Smartphone className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                            )}
                            <div>
                                <p className="text-sm text-white font-medium">
                                    {useBackupCode ? 'Enter a backup code' : 'Enter 6-digit code'}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {useBackupCode
                                        ? 'Use one of the backup codes you saved during setup'
                                        : 'Open your authenticator app (Google Authenticator, Authy)'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Form */}
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <div>
                            <Input
                                {...form.register('code', {
                                    onChange: (e) => {
                                        // Auto-format: remove spaces and non-alphanumeric characters
                                        let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                                        // Format as 'XXX XXX' for 6-digit codes
                                        if (!useBackupCode && value.length > 3) {
                                            value = value.slice(0, 6).replace(/^(\w{3})(\w{0,3})$/, '$1 $2').trim();
                                        } else {
                                            value = value.slice(0, 6);
                                        }
                                        e.target.value = value;
                                        form.setValue('code', value);
                                    }
                                })}
                                type="text"
                                inputMode={useBackupCode ? 'text' : 'numeric'}
                                maxLength={useBackupCode ? 8 : 7}
                                placeholder={useBackupCode ? 'XXXXXXXX' : '000 000'}
                                className="text-center text-3xl tracking-widest font-mono"
                                autoComplete="one-time-code"
                                autoFocus
                                dark
                                error={form.formState.errors.code?.message}
                            />
                        </div>

                        {/* Trust Device */}
                        <label className="flex items-center gap-3 p-2 bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-900/70 transition-colors">
                            <input
                                type="checkbox"
                                {...form.register('trust_device')}
                                className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                            />
                            <div>
                                <span className="text-sm font-medium text-white">Trust this device</span>
                                <p className="text-xs text-slate-400">Skip MFA for 30 days</p>
                            </div>
                        </label>

                        <Button type="submit" size="lg" isLoading={loading} className="w-full">
                            Verify & Continue
                        </Button>
                    </form>

                    {/* Toggle */}
                    <div className="mt-3">
                        <div className="text-center">
                            <button
                                type="button"
                                onClick={() => {
                                    setUseBackupCode(!useBackupCode);
                                    form.reset();
                                    setError(null);
                                }}
                                className="text-xs text-blue-400 hover:text-blue-300 transition-colors underline"
                            >
                                {useBackupCode ? 'Use authenticator app instead' : 'Use backup code instead'}
                            </button>
                        </div>
                    </div>

                    {/* Cancel */}
                    <div className="mt-3 pt-3 border-t border-slate-700">
                        <div className="text-center">
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="text-xs text-slate-400 hover:text-slate-300 transition-colors underline"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>

                    {/* Footer */}
                    <p className="text-center text-xs text-slate-500 mt-3">
                        Authorized personnel only
                    </p>
                </div>
            </div>
        </div>
    );
}

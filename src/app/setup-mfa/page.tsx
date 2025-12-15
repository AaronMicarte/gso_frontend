'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Image from 'next/image';
import { Shield, Copy, Check, AlertTriangle, Loader2, Smartphone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { generateMFASecretForLogin, enableMFADuringLogin } from '@/lib/api/mfa';
import { MFASecretResponse } from '@/types/mfa';

const codeSchema = z.object({
    code: z.string().regex(/^\d{3} \d{3}$/, 'Enter 6 digits as XXX XXX'),
});

type CodeFormData = z.infer<typeof codeSchema>;

export default function SetupMFAPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [secretData, setSecretData] = useState<MFASecretResponse | null>(null);
    const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pendingUserId, setPendingUserId] = useState<number | null>(null);

    const form = useForm<CodeFormData>({
        resolver: zodResolver(codeSchema),
        defaultValues: { code: '' },
    });

    useEffect(() => {
        // Get pending user from sessionStorage (set during login)
        const stored = sessionStorage.getItem('mfa_setup_pending');
        if (!stored) {
            router.replace('/');
            return;
        }

        const { userId } = JSON.parse(stored);
        setPendingUserId(userId);
        generateSecret(userId);
    }, [router]);

    const generateSecret = async (userId: number) => {
        try {
            setLoading(true);
            const data = await generateMFASecretForLogin(userId);
            setSecretData(data);
        } catch {
            setError('Failed to generate QR code. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const verifyCode = async (data: CodeFormData) => {
        if (!secretData || !pendingUserId) return;

        try {
            setLoading(true);
            setError(null);
            const response = await enableMFADuringLogin(pendingUserId, secretData.secret, data.code.replace(/\s/g, ''));
            setBackupCodes(response.backup_codes);
            setStep(3);
        } catch {
            setError('Invalid code. Please check your authenticator app.');
            form.reset();
        } finally {
            setLoading(false);
        }
    };

    const copyBackupCodes = () => {
        if (backupCodes) {
            navigator.clipboard.writeText(backupCodes.join('\n'));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleComplete = () => {
        // Clear the pending state
        sessionStorage.removeItem('mfa_setup_pending');
        // Redirect to login to complete authentication
        router.replace('/?mfa_setup=complete');
    };

    if (loading && !secretData) {
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
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 mb-4">
                            <Shield className="w-8 h-8 text-blue-400" />
                        </div>
                        <h1 className="text-2xl font-bold text-white">Set Up Two-Factor Authentication</h1>
                        <p className="text-slate-400 mt-2">Required for your account security</p>
                    </div>

                    {/* Progress Steps */}
                    <div className="flex items-center justify-center gap-2 mb-8">
                        {[1, 2, 3].map((s) => (
                            <div key={s} className="flex items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${step >= s ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'
                                    }`}>
                                    {step > s ? <Check className="w-4 h-4" /> : s}
                                </div>
                                {s < 3 && (
                                    <div className={`w-12 h-1 mx-1 rounded ${step > s ? 'bg-blue-600' : 'bg-slate-700'}`} />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* Step 1: Scan QR */}
                    {step === 1 && secretData && (
                        <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700">
                            <div className="flex items-center gap-3 mb-6">
                                <Smartphone className="w-6 h-6 text-blue-400" />
                                <div>
                                    <h2 className="text-lg font-semibold text-white">Scan QR Code</h2>
                                    <p className="text-sm text-slate-400">Use Google Authenticator or Authy</p>
                                </div>
                            </div>

                            <div className="flex justify-center mb-6">
                                <div className="bg-white p-4 rounded-xl">
                                    {secretData.qr_code_url ? (
                                        <QRCodeSVG value={secretData.qr_code_url} size={180} level="M" />
                                    ) : (
                                        <div className="w-[180px] h-[180px] bg-red-100 border-2 border-red-300 rounded flex items-center justify-center">
                                            <div className="text-center text-red-600 p-4">
                                                <div className="text-sm font-medium mb-2">QR Code Failed</div>
                                                <div className="text-xs text-gray-600">
                                                    Enter manually:<br />
                                                    <code className="bg-gray-200 px-1 rounded text-xs mt-1 block">{secretData.secret}</code>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>                            <div className="text-center mb-6">
                                <p className="text-xs text-slate-500 mb-2">Can&apos;t scan? Enter this code manually:</p>
                                <div className="inline-flex items-center gap-2 bg-slate-900 px-4 py-2 rounded-lg">
                                    <code className="text-sm font-mono text-slate-300">{secretData.secret}</code>
                                    <button
                                        onClick={() => navigator.clipboard.writeText(secretData.secret)}
                                        className="text-blue-400 hover:text-blue-300 p-1"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </button>
                                </div>
                                {/* Manual entry backup */}
                                <div className="text-center text-xs text-slate-500 mt-2">
                                    If scanning doesn&apos;t work, you can manually enter this code in your authenticator app:
                                    <br />
                                    <code className="bg-slate-900/50 px-2 py-1 rounded mt-1 inline-block font-mono text-slate-300">{secretData.secret}</code>
                                </div>
                            </div>

                            {/* Can't use authenticator? - REMOVED FOR CLEANER LAYOUT */}

                            <Button size="lg" onClick={() => setStep(2)} className="w-full">
                                I&apos;ve Scanned the Code
                            </Button>

                            {/* Retry button if QR failed */}
                            {!secretData.qr_code_url && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => pendingUserId && generateSecret(pendingUserId)}
                                    className="w-full mt-2"
                                    isLoading={loading}
                                >
                                    Retry QR Code Generation
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Step 2: Verify */}
                    {step === 2 && (
                        <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700">
                            <h2 className="text-lg font-semibold text-white mb-2">Verify Setup</h2>
                            <p className="text-sm text-slate-400 mb-6">
                                Enter the 6-digit code from your authenticator app
                            </p>

                            <form onSubmit={form.handleSubmit(verifyCode)} className="space-y-6">
                                <Input
                                    {...form.register('code', {
                                        onChange: (e) => {
                                            // Auto-format: remove spaces and non-alphanumeric characters
                                            let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                                            // Format as 'XXX XXX' for 6-digit codes
                                            if (value.length > 3) {
                                                value = value.slice(0, 6).replace(/^(\w{3})(\w{0,3})$/, '$1 $2').trim();
                                            } else {
                                                value = value.slice(0, 6);
                                            }
                                            e.target.value = value;
                                            form.setValue('code', value);
                                        }
                                    })}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={7}
                                    autoFocus
                                    placeholder="000 000"
                                    className="text-center text-3xl tracking-widest font-mono"
                                    autoComplete="one-time-code"
                                    dark
                                    error={form.formState.errors.code?.message}
                                />

                                <div className="flex gap-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setStep(1)}
                                        className="flex-1"
                                    >
                                        Back
                                    </Button>
                                    <Button type="submit" isLoading={loading} className="flex-1">
                                        Verify
                                    </Button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Step 3: Backup Codes */}
                    {step === 3 && backupCodes && (
                        <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700">
                            <div className="text-center mb-6">
                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20 mb-3">
                                    <Check className="w-6 h-6 text-green-400" />
                                </div>
                                <h2 className="text-lg font-semibold text-white">Save Your Backup Codes</h2>
                                <p className="text-sm text-slate-400 mt-1">
                                    Store these somewhere safe. Use them if you lose your phone.
                                </p>
                            </div>

                            <div className="bg-slate-900 rounded-xl p-4 mb-4">
                                <div className="grid grid-cols-2 gap-2">
                                    {backupCodes.map((code, i) => (
                                        <code key={i} className="text-center py-2 px-3 bg-slate-800 rounded text-slate-200 font-mono text-sm">
                                            {code}
                                        </code>
                                    ))}
                                </div>
                            </div>

                            <Button
                                variant="outline"
                                onClick={copyBackupCodes}
                                className="w-full mb-4 flex items-center justify-center gap-2"
                            >
                                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                {copied ? 'Copied!' : 'Copy All Codes'}
                            </Button>

                            <Button size="lg" onClick={handleComplete} className="w-full">
                                Continue to Login
                            </Button>
                        </div>
                    )}

                    {/* Footer */}
                    <p className="text-center text-xs text-slate-400 mt-6">
                        Two-factor authentication adds an extra layer of security to your account
                    </p>
                </div>
            </div>
        </div>
    );
}

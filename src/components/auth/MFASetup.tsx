'use client';

import { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, Loader2, Copy, Check, Smartphone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import {
    getMFAStatus,
    generateMFASecret,
    enableMFA,
    disableMFA,
} from '@/lib/api/mfa';
import { MFAStatus as StatusResponse, MFASecretResponse, MFAEnableResponse } from '@/types/mfa';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

interface LocalStatus {
    enabled: boolean;
    has_backup_codes: boolean;
    trusted_devices_count: number;
}

const codeSchema = z.object({
    code: z.string().regex(/^[0-9]{6}$/, 'Enter a 6-digit code'),
});

type CodeForm = z.infer<typeof codeSchema>;

export default function MFASetup() {
    const [status, setStatus] = useState<LocalStatus | null>(null);
    const [loading, setLoading] = useState(true);

    // Wizard state
    const [step, setStep] = useState(0); // 0=none,1=scan,2=verify,3=done
    const [secretData, setSecretData] = useState<MFASecretResponse | null>(null);
    const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    const form = useForm<CodeForm>({
        resolver: zodResolver(codeSchema),
        defaultValues: { code: '' },
    });

    useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        try {
            setLoading(true);
            const res = await getMFAStatus();
            setStatus(res as unknown as LocalStatus);
        } catch {
            toast.error('Failed to load MFA status.');
        } finally {
            setLoading(false);
        }
    };

    const startEnable = async () => {
        try {
            setLoading(true);
            const data = await generateMFASecret();
            setSecretData(data);
            setStep(1);
        } catch {
            toast.error('Could not generate MFA secret.');
        } finally {
            setLoading(false);
        }
    };

    const verifyCode = async (values: CodeForm) => {
        if (!secretData) return;
        try {
            setLoading(true);
            setError(null);
            const res = await enableMFA(secretData.secret, values.code);
            setBackupCodes(res.backup_codes);
            setStep(3);
            // Refresh status
            fetchStatus();
        } catch (e: unknown) {
            const err = e as { response?: { data?: { error?: string } } };
            setError(err?.response?.data?.error || 'Invalid code.');
        } finally {
            setLoading(false);
        }
    };

    const finishWizard = () => {
        setStep(0);
        setSecretData(null);
        setBackupCodes(null);
        form.reset();
        toast.success('MFA has been enabled.');
    };

    const handleDisable = async () => {
        const password = prompt('Enter your password to disable MFA:');
        if (!password) return;
        const code = prompt('Enter a 6-digit code from your authenticator app:');
        if (!code) return;

        try {
            setLoading(true);
            await disableMFA({ password, code });
            toast.success('MFA has been disabled');
            fetchStatus();
        } catch (e: unknown) {
            const err = e as { response?: { data?: { error?: string } } };
            toast.error(err?.response?.data?.error || 'Failed to disable MFA');
        } finally {
            setLoading(false);
        }
    };

    if (loading && !status) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        );
    }

    // Render wizard if active
    if (step > 0) {
        return (
            <div className="space-y-6">
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                        {error}
                    </div>
                )}
                {step === 1 && secretData && (
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold mb-4">Scan the QR code</h3>
                        <div className="flex justify-center mb-4">
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
                        </div>
                        <Button onClick={() => setStep(2)} className="w-full">
                            I&apos;ve scanned the code
                        </Button>
                    </div>
                )}
                {step === 2 && (
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold mb-4">Verify code</h3>
                        <form onSubmit={form.handleSubmit(verifyCode)} className="space-y-4">
                            <input
                                {...form.register('code')}
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                placeholder="000000"
                                className="w-full text-center text-3xl tracking-widest font-mono border rounded p-2"
                                autoFocus
                            />
                            <div className="flex gap-3">
                                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                                    Back
                                </Button>
                                <Button type="submit" isLoading={loading} className="flex-1">
                                    Verify
                                </Button>
                            </div>
                        </form>
                    </div>
                )}
                {step === 3 && backupCodes && (
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold mb-4">Backup Codes</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Save these codes somewhere secure. Each one can be used once to access your account if you lose your authenticator.
                        </p>
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            {backupCodes.map((c, i) => (
                                <code key={i} className="text-center py-2 px-3 bg-gray-100 rounded font-mono">
                                    {c}
                                </code>
                            ))}
                        </div>
                        <Button onClick={finishWizard} className="w-full">
                            Done
                        </Button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-start gap-4">
                    {status?.enabled ? (
                        <CheckCircle className="w-8 h-8 text-green-500 mt-1" />
                    ) : (
                        <AlertTriangle className="w-8 h-8 text-amber-500 mt-1" />
                    )}
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Two-Factor Authentication (2FA)
                        </h3>
                        <p className="text-gray-600 mb-4">
                            {status?.enabled
                                ? 'Two-factor authentication is currently enabled for your account. This adds an extra layer of security.'
                                : 'Two-factor authentication is not enabled. Enable it to add an extra layer of security to your account.'
                            }
                        </p>

                        {status?.enabled && (
                            <p className="text-sm text-gray-500 mb-4">
                                Trusted devices: {status.trusted_devices_count}
                            </p>
                        )}

                        <div className="flex gap-3">
                            {!status?.enabled ? (
                                <Button onClick={startEnable} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                            Loading...
                                        </>
                                    ) : (
                                        <>
                                            <Shield className="w-4 h-4 mr-2" />
                                            Enable 2FA
                                        </>
                                    )}
                                </Button>
                            ) : (
                                <Button
                                    onClick={handleDisable}
                                    disabled={loading}
                                    variant="outline"
                                    className="border-red-300 text-red-600 hover:bg-red-50"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                            Processing...
                                        </>
                                    ) : (
                                        'Disable 2FA'
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {status?.enabled && (
                <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
                    <div className="flex items-start gap-3">
                        <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                            <h4 className="font-medium text-blue-900 mb-1">Security Benefits</h4>
                            <p className="text-sm text-blue-700">
                                With 2FA enabled, you&apos;ll need both your password and a verification code from your authenticator app to sign in.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
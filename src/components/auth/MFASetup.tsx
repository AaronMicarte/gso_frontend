'use client';

import { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';

interface MFAStatus {
    enabled: boolean;
    lastUsed?: string;
}

export default function MFASetup() {
    const [status, setStatus] = useState<MFAStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [enabling, setEnabling] = useState(false);

    useEffect(() => {
        // Mock loading MFA status - replace with actual API call
        setTimeout(() => {
            setStatus({ enabled: false });
            setLoading(false);
        }, 1000);
    }, []);

    const handleEnableMFA = async () => {
        setEnabling(true);
        try {
            // Mock enabling MFA - replace with actual API call
            await new Promise(resolve => setTimeout(resolve, 2000));
            setStatus({ enabled: true, lastUsed: new Date().toISOString() });
            toast.success('Two-Factor Authentication enabled successfully!');
        } catch (error) {
            toast.error('Failed to enable MFA. Please try again.');
        } finally {
            setEnabling(false);
        }
    };

    const handleDisableMFA = async () => {
        if (!confirm('Are you sure you want to disable Two-Factor Authentication? This will make your account less secure.')) {
            return;
        }

        setEnabling(true);
        try {
            // Mock disabling MFA - replace with actual API call
            await new Promise(resolve => setTimeout(resolve, 2000));
            setStatus({ enabled: false });
            toast.success('Two-Factor Authentication disabled.');
        } catch (error) {
            toast.error('Failed to disable MFA. Please try again.');
        } finally {
            setEnabling(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
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

                        {status?.enabled && status.lastUsed && (
                            <p className="text-sm text-gray-500 mb-4">
                                Last used: {new Date(status.lastUsed).toLocaleDateString()}
                            </p>
                        )}

                        <div className="flex gap-3">
                            {!status?.enabled ? (
                                <Button
                                    onClick={handleEnableMFA}
                                    disabled={enabling}
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    {enabling ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                            Enabling...
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
                                    onClick={handleDisableMFA}
                                    disabled={enabling}
                                    variant="outline"
                                    className="border-red-300 text-red-600 hover:bg-red-50"
                                >
                                    {enabling ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                            Disabling...
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
                                With 2FA enabled, you'll need both your password and a verification code from your authenticator app to sign in.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
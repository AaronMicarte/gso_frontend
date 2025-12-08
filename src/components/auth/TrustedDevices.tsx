'use client';

import { useState, useEffect } from 'react';
import { Smartphone, Trash2, Loader2, AlertTriangle, Shield, Calendar, Clock, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getTrustedDevices, revokeTrustedDevice } from '@/lib/api/mfa';
import { TrustedDevice } from '@/types/mfa';

export default function TrustedDevices() {
    const [devices, setDevices] = useState<TrustedDevice[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [revoking, setRevoking] = useState<number | null>(null);

    useEffect(() => {
        fetchDevices();
    }, []);

    const fetchDevices = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await getTrustedDevices();
            setDevices(response.devices);
        } catch (err) {
            setError('Failed to load trusted devices. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleRevoke = async (deviceId: number) => {
        if (!confirm('Are you sure you want to remove this trusted device? You will need to verify MFA next time you log in from this device.')) {
            return;
        }

        try {
            setRevoking(deviceId);
            await revokeTrustedDevice(deviceId);
            setDevices(devices.filter(d => d.device_id !== deviceId));
        } catch (err) {
            setError('Failed to revoke device. Please try again.');
        } finally {
            setRevoking(null);
        }
    };

    // Format date for display (PH Manila time)
    const formatDate = (dateString: string | null): string => {
        if (!dateString) return 'Never';
        try {
            const date = new Date(dateString);
            return date.toLocaleString('en-PH', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
                timeZone: 'Asia/Manila',
            });
        } catch {
            return dateString;
        }
    };

    // Get relative time
    const getRelativeTime = (dateString: string | null): string => {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffMinutes = Math.floor(diffMs / (1000 * 60));

            if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
            if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
            if (diffMinutes > 0) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
            return 'Just now';
        } catch {
            return '';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Shield className="w-8 h-8 text-blue-600" />
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Trusted Devices</h2>
                    <p className="text-sm text-gray-500">Devices that can skip MFA verification</p>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    <span>{error}</span>
                </div>
            )}

            {/* No devices */}
            {devices.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                    <Smartphone className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No trusted devices registered.</p>
                    <p className="text-sm mt-1">When you check "Trust this device" during MFA verification, it will appear here.</p>
                </div>
            )}

            {/* Device List */}
            {devices.length > 0 && (
                <div className="space-y-4">
                    {devices.map((device) => (
                        <div
                            key={device.device_id}
                            className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3">
                                    <div className="bg-blue-100 p-2 rounded-lg">
                                        <Smartphone className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-gray-900">
                                            {device.device_name || 'Unknown Device'}
                                        </h3>

                                        {/* Device Info */}
                                        <div className="mt-2 space-y-1 text-sm text-gray-500">
                                            {device.ip_address && (
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="w-4 h-4" />
                                                    <span>IP: {device.ip_address}</span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-4 h-4" />
                                                <span>Added: {formatDate(device.created_at)}</span>
                                            </div>
                                            {device.last_used_at && (
                                                <div className="flex items-center gap-2">
                                                    <Clock className="w-4 h-4" />
                                                    <span>Last used: {getRelativeTime(device.last_used_at)}</span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2">
                                                <AlertTriangle className="w-4 h-4" />
                                                <span>Expires: {formatDate(device.expires_at)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Revoke Button */}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRevoke(device.device_id)}
                                    disabled={revoking === device.device_id}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                    {revoking === device.device_id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="w-4 h-4" />
                                    )}
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Info box */}
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-md p-4">
                <h4 className="font-medium text-blue-800 mb-1">About Trusted Devices</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Trusted devices can skip MFA verification for 30 days.</li>
                    <li>• You can remove a device at any time to require MFA again.</li>
                    <li>• All trusted devices are automatically removed when you change your password.</li>
                    <li>• For security, review this list regularly and remove any devices you don't recognize.</li>
                </ul>
            </div>
        </div>
    );
}

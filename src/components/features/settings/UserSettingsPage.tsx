'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Bell,
    ChevronRight,
    Eye,
    LayoutDashboard,
    Loader2,
    Settings,
    Shield,
    Smartphone,
    UserCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/hooks/useAuth';
import MFASetup from '@/components/auth/MFASetup';
import TrustedDevices from '@/components/auth/TrustedDevices';

type LandingOption = {
    label: string;
    route: string;
};

type SettingsPreferences = {
    defaultLandingRoute: string;
    browserAlerts: boolean;
    emailDigests: boolean;
    reduceMotion: boolean;
};

interface UserSettingsPageProps {
    baseRoute: string;
    roleLabel: string;
    landingOptions: LandingOption[];
}

const FALLBACK_PREFS: SettingsPreferences = {
    defaultLandingRoute: '',
    browserAlerts: true,
    emailDigests: false,
    reduceMotion: false,
};

function getStorageKey(userId: number): string {
    return `gso_settings_v1_${userId}`;
}

function mergePreferences(stored: Partial<SettingsPreferences>, fallbackRoute: string): SettingsPreferences {
    return {
        defaultLandingRoute: stored.defaultLandingRoute || fallbackRoute,
        browserAlerts: stored.browserAlerts ?? FALLBACK_PREFS.browserAlerts,
        emailDigests: stored.emailDigests ?? FALLBACK_PREFS.emailDigests,
        reduceMotion: stored.reduceMotion ?? FALLBACK_PREFS.reduceMotion,
    };
}

function applyReduceMotion(value: boolean): void {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('reduce-motion', value);
}

export function UserSettingsPage({ baseRoute, roleLabel, landingOptions }: UserSettingsPageProps) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [prefs, setPrefs] = useState<SettingsPreferences>(
        mergePreferences({}, `${baseRoute}/dashboard`)
    );

    const defaultRoute = useMemo(() => {
        return landingOptions[0]?.route || `${baseRoute}/dashboard`;
    }, [landingOptions, baseRoute]);

    useEffect(() => {
        if (loading || !user) return;

        const key = getStorageKey(user.UserID);
        const raw = localStorage.getItem(key);
        if (!raw) {
            const initial = mergePreferences({}, defaultRoute);
            setPrefs(initial);
            applyReduceMotion(initial.reduceMotion);
            return;
        }

        try {
            const parsed = JSON.parse(raw) as Partial<SettingsPreferences>;
            const hydrated = mergePreferences(parsed, defaultRoute);
            setPrefs(hydrated);
            applyReduceMotion(hydrated.reduceMotion);
        } catch {
            const initial = mergePreferences({}, defaultRoute);
            setPrefs(initial);
            applyReduceMotion(initial.reduceMotion);
        }
    }, [loading, user, defaultRoute]);

    const savePreferences = async () => {
        if (!user) return;

        setSaving(true);
        try {
            const validatedPrefs = mergePreferences(prefs, defaultRoute);
            localStorage.setItem(getStorageKey(user.UserID), JSON.stringify(validatedPrefs));
            applyReduceMotion(validatedPrefs.reduceMotion);
            toast.success('Settings saved', {
                description: 'Your account preferences were saved on this device.',
            });
        } finally {
            setSaving(false);
        }
    };

    const resetPreferences = () => {
        if (!user) return;

        const reset = mergePreferences({}, defaultRoute);
        localStorage.setItem(getStorageKey(user.UserID), JSON.stringify(reset));
        setPrefs(reset);
        applyReduceMotion(reset.reduceMotion);
        toast.success('Preferences reset', {
            description: 'Default settings have been restored.',
        });
    };

    if (loading) {
        return (
            <div className="p-6">
                <div className="rounded-xl border border-slate-200 bg-white p-8 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
                </div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}>
            <div className="p-4 md:p-6 space-y-6">
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-2">
                        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <Settings className="w-4 h-4" />
                            Account Settings
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900">{roleLabel} Settings</h1>
                        <p className="text-sm text-slate-600 max-w-3xl">
                            This page contains the settings that actually matter for day-to-day work: account visibility,
                            security controls, and operational defaults.
                        </p>
                    </div>
                </section>

                <Tabs defaultValue="account" className="w-full">
                    <TabsList className="grid w-full grid-cols-1 gap-1 sm:grid-cols-3 mb-4">
                        <TabsTrigger value="account" className="flex items-center gap-2">
                            <UserCircle2 className="w-4 h-4" />
                            Account
                        </TabsTrigger>
                        <TabsTrigger value="preferences" className="flex items-center gap-2">
                            <LayoutDashboard className="w-4 h-4" />
                            Preferences
                        </TabsTrigger>
                        <TabsTrigger value="security" className="flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            Security
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="account" className="space-y-4">
                        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h2 className="text-lg font-semibold text-slate-900 mb-4">Profile Snapshot</h2>
                            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div>
                                    <dt className="text-slate-500">Full Name</dt>
                                    <dd className="font-medium text-slate-900">{user.FullName || user.Username}</dd>
                                </div>
                                <div>
                                    <dt className="text-slate-500">Username</dt>
                                    <dd className="font-medium text-slate-900">{user.Username}</dd>
                                </div>
                                <div>
                                    <dt className="text-slate-500">Email</dt>
                                    <dd className="font-medium text-slate-900">{user.Email}</dd>
                                </div>
                                <div>
                                    <dt className="text-slate-500">Department</dt>
                                    <dd className="font-medium text-slate-900">{user.Department}</dd>
                                </div>
                                <div>
                                    <dt className="text-slate-500">Role</dt>
                                    <dd className="font-medium text-slate-900">{user.Role}</dd>
                                </div>
                                <div>
                                    <dt className="text-slate-500">MFA Status</dt>
                                    <dd className="font-medium text-slate-900">{user.MFAEnabled ? 'Enabled' : 'Disabled'}</dd>
                                </div>
                            </dl>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h2 className="text-lg font-semibold text-slate-900 mb-2">Quick Access</h2>
                            <p className="text-sm text-slate-600 mb-4">
                                Jump directly to your most-used destination.
                            </p>
                            <div className="flex flex-wrap items-center gap-3">
                                <Button
                                    className="w-auto"
                                    onClick={() => router.push(prefs.defaultLandingRoute || defaultRoute)}
                                >
                                    Open Default Landing
                                </Button>
                                <span className="text-sm text-slate-500 inline-flex items-center gap-1">
                                    <ChevronRight className="w-4 h-4" />
                                    {prefs.defaultLandingRoute || defaultRoute}
                                </span>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="preferences" className="space-y-4">
                        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">Operational Preferences</h2>
                                <p className="text-sm text-slate-600">These defaults are saved per account on this browser.</p>
                            </div>

                            <label className="block">
                                <span className="text-sm font-medium text-slate-700">Default landing page</span>
                                <select
                                    value={prefs.defaultLandingRoute}
                                    onChange={(e) => setPrefs((prev) => ({ ...prev, defaultLandingRoute: e.target.value }))}
                                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                                >
                                    {landingOptions.map((option) => (
                                        <option key={option.route} value={option.route}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <div className="grid gap-3">
                                <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
                                    <input
                                        type="checkbox"
                                        checked={prefs.browserAlerts}
                                        onChange={(e) => setPrefs((prev) => ({ ...prev, browserAlerts: e.target.checked }))}
                                        className="mt-1"
                                    />
                                    <div>
                                        <p className="text-sm font-medium text-slate-800 inline-flex items-center gap-2">
                                            <Bell className="w-4 h-4" />
                                            Browser alerts for important workflow events
                                        </p>
                                        <p className="text-xs text-slate-500">Use in-app browser alerts for key updates.</p>
                                    </div>
                                </label>

                                <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
                                    <input
                                        type="checkbox"
                                        checked={prefs.emailDigests}
                                        onChange={(e) => setPrefs((prev) => ({ ...prev, emailDigests: e.target.checked }))}
                                        className="mt-1"
                                    />
                                    <div>
                                        <p className="text-sm font-medium text-slate-800">Daily email digest preference</p>
                                        <p className="text-xs text-slate-500">
                                            Marks your preference for digest notifications when email digest automation is enabled.
                                        </p>
                                    </div>
                                </label>

                                <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
                                    <input
                                        type="checkbox"
                                        checked={prefs.reduceMotion}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            setPrefs((prev) => ({ ...prev, reduceMotion: checked }));
                                            applyReduceMotion(checked);
                                        }}
                                        className="mt-1"
                                    />
                                    <div>
                                        <p className="text-sm font-medium text-slate-800 inline-flex items-center gap-2">
                                            <Eye className="w-4 h-4" />
                                            Reduce motion
                                        </p>
                                        <p className="text-xs text-slate-500">Minimizes transitions and animations for accessibility.</p>
                                    </div>
                                </label>
                            </div>

                            <div className="flex flex-wrap gap-3 pt-1">
                                <Button className="w-auto" onClick={savePreferences} isLoading={saving}>
                                    Save Preferences
                                </Button>
                                <Button className="w-auto" variant="outline" onClick={resetPreferences}>
                                    Reset to Defaults
                                </Button>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="security" className="space-y-4">
                        {/* <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h2 className="text-lg font-semibold text-slate-900 inline-flex items-center gap-2">
                                <Shield className="w-5 h-5" />
                                Authentication Controls
                            </h2>
                            <p className="text-sm text-slate-600 mt-1 mb-4">
                                Manage MFA and remove any trusted device you no longer recognize.
                            </p>
                            <MFASetup />
                        </div> */}

                        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h2 className="text-lg font-semibold text-slate-900 inline-flex items-center gap-2 mb-4">
                                <Smartphone className="w-5 h-5" />
                                Trusted Devices
                            </h2>
                            <TrustedDevices />
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

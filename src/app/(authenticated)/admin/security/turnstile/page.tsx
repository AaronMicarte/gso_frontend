'use client';

import { useState } from 'react';
import { ShieldCheck, RefreshCw, KeyRound, ToggleLeft, CircleAlert, CircleCheck } from 'lucide-react';
import { TurnstileWidget } from '@/components/auth/TurnstileWidget';
import { isTurnstileEnabled } from '@/lib/turnstile';

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
    return (
        <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${ok
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-rose-100 text-rose-800 border border-rose-200'
                }`}
        >
            {ok ? <CircleCheck className="h-3.5 w-3.5" /> : <CircleAlert className="h-3.5 w-3.5" />}
            {label}
        </span>
    );
}

export default function AdminTurnstilePage() {
    const enabled = isTurnstileEnabled();
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
    const rawEnabled = process.env.NEXT_PUBLIC_TURNSTILE_ENABLED ?? '';

    const [token, setToken] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [lastSolvedAt, setLastSolvedAt] = useState<string | null>(null);

    const handleTokenChange = (nextToken: string | null) => {
        setToken(nextToken);
        if (nextToken) {
            setLastSolvedAt(new Date().toLocaleString());
        }
    };

    return (
        <div className="mx-auto max-w-6xl px-4 py-8">
            <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Turnstile Console</h1>
                    <p className="mt-2 text-sm text-slate-600">
                        Monitor and validate Cloudflare Turnstile behavior in the admin portal.
                    </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Current Mode</p>
                    <div className="mt-2">
                        <StatusBadge ok={enabled} label={enabled ? 'Protection Enabled' : 'Protection Disabled'} />
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-2 flex items-center gap-2 text-slate-700">
                        <ToggleLeft className="h-4 w-4" />
                        <p className="text-xs font-semibold uppercase tracking-wide">Enable Flag</p>
                    </div>
                    <p className="text-sm font-medium text-slate-900">
                        {rawEnabled.trim() !== '' ? rawEnabled : 'Not Set'}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">Source: NEXT_PUBLIC_TURNSTILE_ENABLED</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-2 flex items-center gap-2 text-slate-700">
                        <KeyRound className="h-4 w-4" />
                        <p className="text-xs font-semibold uppercase tracking-wide">Site Key</p>
                    </div>
                    <p className="text-sm font-medium text-slate-900 break-all">
                        {siteKey ? `${siteKey.slice(0, 8)}...${siteKey.slice(-6)}` : 'Missing'}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">Source: NEXT_PUBLIC_TURNSTILE_SITE_KEY</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-2 flex items-center gap-2 text-slate-700">
                        <ShieldCheck className="h-4 w-4" />
                        <p className="text-xs font-semibold uppercase tracking-wide">Live Challenge</p>
                    </div>
                    <StatusBadge ok={Boolean(token)} label={token ? 'Challenge Solved' : 'Awaiting Challenge'} />
                    <p className="mt-2 text-xs text-slate-500">
                        {lastSolvedAt ? `Last solved: ${lastSolvedAt}` : 'No successful challenge in this session'}
                    </p>
                </div>
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Turnstile Preview</h2>
                        <p className="text-sm text-slate-600">Use this panel to validate that the challenge renders and returns a token.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setRefreshKey((prev) => prev + 1);
                            setToken(null);
                        }}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Reset Challenge
                    </button>
                </div>

                {enabled ? (
                    <div className="space-y-4">
                        <TurnstileWidget
                            onTokenChange={handleTokenChange}
                            refreshKey={refreshKey}
                            className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                        />
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Token State</p>
                            <p className="mt-1 break-all text-xs text-slate-700">
                                {token ? `${token.slice(0, 18)}...` : 'No token yet. Complete the challenge to generate one.'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                        Turnstile is currently disabled in this frontend environment. Enable the feature flag and site key to preview the widget.
                    </div>
                )}
            </div>
        </div>
    );
}

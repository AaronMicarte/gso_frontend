'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { isTurnstileEnabled } from '@/lib/turnstile';

declare global {
    interface Window {
        turnstile?: {
            render: (
                container: string | HTMLElement,
                options: {
                    sitekey: string;
                    callback?: (token: string) => void;
                    'error-callback'?: () => void;
                    'expired-callback'?: () => void;
                    theme?: 'light' | 'dark' | 'auto';
                }
            ) => string;
            remove: (widgetId: string) => void;
        };
    }
}

interface TurnstileWidgetProps {
    onTokenChange: (token: string | null) => void;
    theme?: 'light' | 'dark' | 'auto';
    refreshKey?: number;
    className?: string;
}

const SCRIPT_ID = 'cf-turnstile-script';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export function TurnstileWidget({
    onTokenChange,
    theme = 'auto',
    refreshKey = 0,
    className,
}: TurnstileWidgetProps) {
    const [ready, setReady] = useState<boolean>(() => {
        if (typeof window === 'undefined') {
            return false;
        }

        return !!window.turnstile;
    });
    const [scriptError, setScriptError] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const widgetIdRef = useRef<string | null>(null);

    const enabled = useMemo(() => isTurnstileEnabled(), []);
    const siteKey = useMemo(() => process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '', []);

    useEffect(() => {
        if (!enabled) {
            return;
        }

        if (typeof window === 'undefined') {
            return;
        }

        if (window.turnstile) {
            return;
        }

        const existingScript = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
        if (existingScript) {
            const handleLoad = () => setReady(true);
            const handleError = () => setScriptError('Captcha script failed to load.');

            existingScript.addEventListener('load', handleLoad);
            existingScript.addEventListener('error', handleError);

            return () => {
                existingScript.removeEventListener('load', handleLoad);
                existingScript.removeEventListener('error', handleError);
            };
        }

        const handleLoad = () => setReady(true);
        const handleError = () => setScriptError('Captcha script failed to load.');

        const script = document.createElement('script');
        script.id = SCRIPT_ID;
        script.src = SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        script.addEventListener('load', handleLoad);
        script.addEventListener('error', handleError);

        document.head.appendChild(script);

        return () => {
            script.removeEventListener('load', handleLoad);
            script.removeEventListener('error', handleError);
        };
    }, [enabled]);

    useEffect(() => {
        onTokenChange(null);

        if (!enabled) {
            return;
        }

        if (!ready || !containerRef.current || !window.turnstile || !siteKey) {
            return;
        }

        if (widgetIdRef.current) {
            window.turnstile.remove(widgetIdRef.current);
            widgetIdRef.current = null;
        }

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            theme,
            callback: (token: string) => onTokenChange(token),
            'expired-callback': () => onTokenChange(null),
            'error-callback': () => onTokenChange(null),
        });

        return () => {
            if (widgetIdRef.current && window.turnstile) {
                window.turnstile.remove(widgetIdRef.current);
                widgetIdRef.current = null;
            }
        };
    }, [enabled, ready, siteKey, theme, refreshKey, onTokenChange]);

    if (!enabled) {
        return null;
    }

    if (!siteKey) {
        return (
            <p className="text-xs text-amber-600" role="alert">
                Captcha is not configured on this frontend environment.
            </p>
        );
    }

    return (
        <div className={className}>
            <div ref={containerRef} />
            {scriptError && (
                <p className="mt-2 text-xs text-rose-500" role="alert">
                    {scriptError}
                </p>
            )}
        </div>
    );
}

const truthy = new Set(['1', 'true', 'yes', 'on']);

export function isTurnstileEnabled(): boolean {
    const rawEnabled = process.env.NEXT_PUBLIC_TURNSTILE_ENABLED;

    if (typeof rawEnabled === 'string' && rawEnabled.trim() !== '') {
        return truthy.has(rawEnabled.trim().toLowerCase());
    }

    // Backward compatibility: if explicit flag is absent, key presence enables captcha.
    return Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}

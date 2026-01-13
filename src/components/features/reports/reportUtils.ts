import { formatInTimeZone } from 'date-fns-tz';

export function manilaYmd(date: Date): string {
    return formatInTimeZone(date, 'Asia/Manila', 'yyyy-MM-dd');
}

export function todayManilaYmd(): string {
    return manilaYmd(new Date());
}

export function daysAgoManilaYmd(days: number): string {
    const now = new Date();
    const d = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return manilaYmd(d);
}

export function csvEscape(value: string): string {
    const needsQuotes = value.includes(',') || value.includes('\n') || value.includes('"');
    const escaped = value.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
}

export function downloadTextFile(filename: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });

    // Legacy Edge/IE (mainly for kiosk environments)
    const nav = window.navigator as unknown as { msSaveOrOpenBlob?: (b: Blob, name: string) => boolean };
    if (typeof nav.msSaveOrOpenBlob === 'function') {
        nav.msSaveOrOpenBlob(blob, filename);
        return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke on next tick to avoid cutting off the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function safeManilaYmdFromIso(dateString?: string | null): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    return manilaYmd(date);
}

export function getErrorMessage(error: unknown): string {
    if (!error) return 'Unknown error';
    if (typeof error === 'string') return error;

    if (error instanceof Error) {
        return error.message || 'An error occurred';
    }

    if (typeof error === 'object') {
        const maybeMessage = (error as { message?: unknown }).message;
        if (typeof maybeMessage === 'string' && maybeMessage.trim().length > 0) return maybeMessage;

        // apiClient sometimes rejects with custom objects (e.g., lockout)
        const locked = (error as { locked?: unknown }).locked;
        const seconds = (error as { seconds_remaining?: unknown }).seconds_remaining;
        if (locked === true && typeof seconds === 'number') {
            return `Locked. Try again in ${seconds}s.`;
        }
    }

    return 'An error occurred';
}

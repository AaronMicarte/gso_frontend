import { IAR } from '@/types/iar';

export const resolveStorageUrl = (url?: string | null) => {
    if (!url) return '';
    // Return data URLs or blob URLs as-is
    if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) return url;
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || '';
    // Ensure leading slash
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${base}${path}`;
};

export const resolveSignatureUrl = (iar: IAR, role: 'inspected' | 'accepted'): string | null => {
    if (role === 'inspected') {
        // Prefer stored file relationship
        if (iar.inspectedSignature?.url) return iar.inspectedSignature.url;
        // Fallback to inline base64 data URL (typed via intersection to avoid `any`)
        const withInline = iar as IAR & { inspected_signature?: string };
        if (withInline.inspected_signature) return withInline.inspected_signature;
        return null;
    }

    if (role === 'accepted') {
        if (iar.acceptedSignature?.url) return iar.acceptedSignature.url;
        const withInline = iar as IAR & { accepted_signature?: string | null };
        if (withInline.accepted_signature) return withInline.accepted_signature as string;
        return null;
    }

    return null;
};

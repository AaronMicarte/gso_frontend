import * as React from 'react';

interface ArticlePreviewModalProps {
    open: boolean;
    onClose: () => void;
    imageUrl: string;
    alt?: string;
    className?: string;
}

export function ArticlePreviewModal({ open, onClose, imageUrl, alt = 'Article image', className = '' }: ArticlePreviewModalProps) {
    React.useEffect(() => {
        if (!open) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Article image preview"
            onClick={onClose}
        >
            <div
                className={`relative max-h-[90vh] max-w-[95vw] overflow-hidden rounded-xl bg-black ${className}`}
                onClick={(event) => event.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-2 top-2 z-10 rounded-full bg-white/90 p-1 text-sm text-slate-700 hover:bg-white"
                    aria-label="Close image preview"
                >
                    ✕
                </button>
                <img
                    src={imageUrl}
                    alt={alt}
                    className="h-[calc(90vh-2rem)] w-full object-contain"
                />
            </div>
        </div>
    );
}

import * as React from 'react';
import { Dialog } from '@/components/ui/Dialog';

interface ConfirmOptions {
    title: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void | Promise<void>;
    onCancel?: () => void;
}

export function useConfirmDialog() {
    const [isOpen, setIsOpen] = React.useState(false);
    const [options, setOptions] = React.useState<ConfirmOptions | null>(null);
    const [loading, setLoading] = React.useState(false);

    const showConfirmDialog = (opts: ConfirmOptions) => {
        setOptions(opts);
        setIsOpen(true);
    };

    const handleConfirm = async () => {
        if (!options) return;

        setLoading(true);
        try {
            await options.onConfirm();
        } finally {
            setLoading(false);
            setIsOpen(false);
            setOptions(null);
        }
    };

    const handleCancel = () => {
        options?.onCancel?.();
        setIsOpen(false);
        setOptions(null);
    };

    const ConfirmDialog = () => (
        <Dialog
            title={options?.title || ''}
            description={options?.description}
            open={isOpen}
            onOpenChange={setIsOpen}
            onConfirm={handleConfirm}
            confirmText={options?.confirmText}
            cancelText={options?.cancelText}
            loading={loading}
        />
    );

    return {
        showConfirmDialog,
        ConfirmDialog,
    };
}
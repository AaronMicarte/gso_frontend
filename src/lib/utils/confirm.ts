import { toast } from 'sonner';

interface ConfirmOptions {
    title: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void | Promise<void>;
    onCancel?: () => void;
}

export function showConfirmDialog({
    title,
    description,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm,
    onCancel,
}: ConfirmOptions) {
    toast(title, {
        description,
        duration: Infinity,
        action: {
            label: confirmText,
            onClick: async () => {
                await onConfirm();
            },
        },
        cancel: {
            label: cancelText,
            onClick: () => {
                onCancel?.();
            },
        },
    });
}

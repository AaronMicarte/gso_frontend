import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import * as React from 'react';

interface FormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    children: React.ReactNode;
    contentClassName?: string;
}

export function FormDialog({
    open,
    onOpenChange,
    title,
    description,
    children,
    contentClassName,
}: FormDialogProps) {
    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
                <Dialog.Content
                    className={`fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[96vw] max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl p-6 ${contentClassName || ''}`}
                >
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <Dialog.Title className="text-lg font-semibold text-slate-900">
                                {title}
                            </Dialog.Title>
                            {description && (
                                <Dialog.Description className="text-sm text-slate-600 mt-1">
                                    {description}
                                </Dialog.Description>
                            )}
                        </div>
                        <Dialog.Close asChild>
                            <button
                                type="button"
                                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                aria-label="Close dialog"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </Dialog.Close>
                    </div>
                    <div className="mt-4">{children}</div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

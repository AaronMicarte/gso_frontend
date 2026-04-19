import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

export interface DialogProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root> {
    title: string;
    description?: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    loading?: boolean;
    hideConfirm?: boolean;
    children?: React.ReactNode;
    // Optional class to override content container size/styling for wide dialogs
    contentClassName?: string;
}

export function Dialog({
    title,
    description,
    open,
    onOpenChange,
    onConfirm,
    confirmText = "Confirm",
    cancelText = "Cancel",
    loading = false,
    hideConfirm = false,
    children,
    ...props
}: DialogProps) {
    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} {...props}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 bg-black/30 z-40" />
                <DialogPrimitive.Content
                    className={`fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl w-[calc(100vw-1.5rem)] sm:w-full max-h-[90vh] p-4 sm:p-6 flex flex-col ${props.contentClassName || 'max-w-md'}`}
                >
                    <div className="shrink-0 space-y-1">
                        <DialogPrimitive.Title className="text-lg font-bold text-slate-900">{title}</DialogPrimitive.Title>
                        {description && <DialogPrimitive.Description className="text-slate-600 text-sm">{description}</DialogPrimitive.Description>}
                    </div>

                    <div className="mt-4 overflow-y-auto pr-1">{children}</div>

                    <div className="shrink-0 flex justify-end gap-2 pt-4">
                        <DialogPrimitive.Close asChild>
                            <button
                                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors font-medium text-sm"
                                disabled={loading}
                            >
                                {cancelText}
                            </button>
                        </DialogPrimitive.Close>
                        {!hideConfirm && (
                            <button
                                className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90 transition-colors font-medium text-sm disabled:opacity-60"
                                onClick={onConfirm}
                                disabled={loading}
                            >
                                {loading ? "Processing..." : confirmText}
                            </button>
                        )}
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}

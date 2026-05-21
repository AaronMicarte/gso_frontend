import {
    Activity,
    ArrowLeftRight,
    Box,
    CheckCircle,
    ClipboardCheck,
    ClipboardList,
    FileCheck,
    FileText,
    LogIn,
    LogOut,
    Package,
    RefreshCcw,
    ShieldCheck,
    Signature,
    UserCheck,
    UserX,
    Wrench,
    XCircle,
    type LucideIcon,
} from 'lucide-react';

export interface ActivityPresentationInput {
    action?: string | null;
    action_key?: string | null;
    type?: string | null;
    entity_type?: string | null;
}

interface ActivityVisual {
    icon: LucideIcon;
    iconColorClass: string;
    badgeClass: string;
}

const ACTION_LABELS: Record<string, string> = {
    created: 'Created record',
    created_from_dr: 'Created from delivery receipt',
    approved: 'Approved',
    rejected: 'Rejected',
    completed: 'Completed',

    transfer_requested: 'Transfer request submitted',
    transfer_releasing_approved: 'Transfer release approved',
    transfer_approved: 'Transfer approved',
    transfer_releasing_signed: 'Transfer releasing office signed',
    transfer_receiving_signed: 'Transfer receiving office signed',
    transfer_completed: 'Transfer completed',

    borrow_requested: 'Borrow request submitted',
    borrow_releasing_approved: 'Borrow release approved',
    borrow_approved: 'Borrow approved',
    borrow_borrowed: 'Borrow item released',
    borrow_returned: 'Borrow item returned',
    borrow_partially_returned: 'Borrow item partially returned',

    receiving_signed: 'Receiving office signed',
    releasing_signed: 'Releasing office signed',
    releasing_approved: 'Release approved',

    login: 'User logged in',
    logout: 'User logged out',
    failedlogin: 'Failed login attempt',
};

const ACTION_VISUALS: Record<string, ActivityVisual> = {
    created: {
        icon: FileText,
        iconColorClass: 'text-blue-600',
        badgeClass: 'bg-blue-100 text-blue-800',
    },
    created_from_dr: {
        icon: FileCheck,
        iconColorClass: 'text-amber-600',
        badgeClass: 'bg-amber-100 text-amber-800',
    },
    approved: {
        icon: CheckCircle,
        iconColorClass: 'text-green-600',
        badgeClass: 'bg-green-100 text-green-800',
    },
    rejected: {
        icon: XCircle,
        iconColorClass: 'text-red-600',
        badgeClass: 'bg-red-100 text-red-800',
    },
    completed: {
        icon: ClipboardCheck,
        iconColorClass: 'text-emerald-600',
        badgeClass: 'bg-emerald-100 text-emerald-800',
    },

    transfer_requested: {
        icon: ArrowLeftRight,
        iconColorClass: 'text-violet-600',
        badgeClass: 'bg-violet-100 text-violet-800',
    },
    transfer_releasing_approved: {
        icon: ShieldCheck,
        iconColorClass: 'text-indigo-600',
        badgeClass: 'bg-indigo-100 text-indigo-800',
    },
    transfer_approved: {
        icon: CheckCircle,
        iconColorClass: 'text-green-600',
        badgeClass: 'bg-green-100 text-green-800',
    },
    transfer_releasing_signed: {
        icon: Signature,
        iconColorClass: 'text-cyan-700',
        badgeClass: 'bg-cyan-100 text-cyan-800',
    },
    transfer_receiving_signed: {
        icon: Signature,
        iconColorClass: 'text-sky-700',
        badgeClass: 'bg-sky-100 text-sky-800',
    },
    transfer_completed: {
        icon: ClipboardCheck,
        iconColorClass: 'text-emerald-600',
        badgeClass: 'bg-emerald-100 text-emerald-800',
    },

    borrow_requested: {
        icon: ClipboardList,
        iconColorClass: 'text-orange-600',
        badgeClass: 'bg-orange-100 text-orange-800',
    },
    borrow_releasing_approved: {
        icon: ShieldCheck,
        iconColorClass: 'text-lime-700',
        badgeClass: 'bg-lime-100 text-lime-800',
    },
    borrow_approved: {
        icon: UserCheck,
        iconColorClass: 'text-teal-700',
        badgeClass: 'bg-teal-100 text-teal-800',
    },
    borrow_borrowed: {
        icon: Package,
        iconColorClass: 'text-orange-700',
        badgeClass: 'bg-orange-100 text-orange-800',
    },
    borrow_partially_returned: {
        icon: RefreshCcw,
        iconColorClass: 'text-yellow-700',
        badgeClass: 'bg-yellow-100 text-yellow-800',
    },
    borrow_returned: {
        icon: RefreshCcw,
        iconColorClass: 'text-amber-700',
        badgeClass: 'bg-amber-100 text-amber-800',
    },

    receiving_signed: {
        icon: Signature,
        iconColorClass: 'text-sky-700',
        badgeClass: 'bg-sky-100 text-sky-800',
    },
    releasing_signed: {
        icon: Signature,
        iconColorClass: 'text-cyan-700',
        badgeClass: 'bg-cyan-100 text-cyan-800',
    },
    releasing_approved: {
        icon: ShieldCheck,
        iconColorClass: 'text-indigo-600',
        badgeClass: 'bg-indigo-100 text-indigo-800',
    },

    login: {
        icon: LogIn,
        iconColorClass: 'text-green-600',
        badgeClass: 'bg-green-100 text-green-800',
    },
    logout: {
        icon: LogOut,
        iconColorClass: 'text-blue-600',
        badgeClass: 'bg-blue-100 text-blue-800',
    },
    failedlogin: {
        icon: UserX,
        iconColorClass: 'text-red-600',
        badgeClass: 'bg-red-100 text-red-800',
    },
};

function toActionKey(value?: string | null): string {
    if (!value) return '';

    const compact = value.trim().toLowerCase();

    if (compact === 'user logged in' || compact === 'logged in') return 'login';
    if (compact === 'user logged out' || compact === 'logged out') return 'logout';
    if (compact === 'failed login attempt' || compact === 'failedlogin') return 'failedlogin';

    return compact.replace(/\s+/g, '_').replace(/\./g, '_');
}

export function resolveActivityActionKey(input: ActivityPresentationInput): string {
    const keyed = toActionKey(input.action_key);
    if (keyed) return keyed;

    const actionFromText = toActionKey(input.action);
    if (actionFromText) return actionFromText;

    return '';
}

function humanizeFallback(actionKey: string): string {
    if (!actionKey) return 'Activity recorded';

    return actionKey
        .split('_')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

export function formatActivityAction(input: ActivityPresentationInput): string {
    const actionKey = resolveActivityActionKey(input);
    return ACTION_LABELS[actionKey] ?? humanizeFallback(actionKey);
}

export function getActivityVisual(input: ActivityPresentationInput): ActivityVisual {
    const actionKey = resolveActivityActionKey(input);
    if (ACTION_VISUALS[actionKey]) {
        return ACTION_VISUALS[actionKey];
    }

    const type = (input.entity_type || input.type || '').toLowerCase();

    if (type.includes('transfer')) {
        return {
            icon: ArrowLeftRight,
            iconColorClass: 'text-violet-600',
            badgeClass: 'bg-violet-100 text-violet-800',
        };
    }

    if (type.includes('borrow') || type.includes('return')) {
        return {
            icon: RefreshCcw,
            iconColorClass: 'text-orange-600',
            badgeClass: 'bg-orange-100 text-orange-800',
        };
    }

    if (type.includes('delivery_receipt') || type.includes('inspection')) {
        return {
            icon: FileCheck,
            iconColorClass: 'text-amber-600',
            badgeClass: 'bg-amber-100 text-amber-800',
        };
    }

    if (type.includes('issuance')) {
        return {
            icon: Package,
            iconColorClass: 'text-indigo-600',
            badgeClass: 'bg-indigo-100 text-indigo-800',
        };
    }

    if (type.includes('asset_service') || type.includes('repair')) {
        return {
            icon: Wrench,
            iconColorClass: 'text-yellow-700',
            badgeClass: 'bg-yellow-100 text-yellow-800',
        };
    }

    if (type.includes('inventory') || type.includes('property')) {
        return {
            icon: Box,
            iconColorClass: 'text-slate-700',
            badgeClass: 'bg-slate-100 text-slate-800',
        };
    }

    return {
        icon: Activity,
        iconColorClass: 'text-slate-600',
        badgeClass: 'bg-slate-100 text-slate-700',
    };
}

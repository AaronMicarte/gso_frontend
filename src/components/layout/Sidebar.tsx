'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { User } from '@/types/auth';
import { toast } from 'sonner';
import {
    deleteNotification,
    deleteAllNotifications,
    NotificationItem,
    getUnreadNotificationCount,
    listRecentNotifications,
    markAllNotificationsRead,
    markNotificationRead,
} from '@/lib/api/notifications';
import {
    LayoutDashboard,
    LogOut,
    LucideIcon,
    ChevronDown,
    FileText,
    ClipboardList,
    Building2,
    Trash2,
    ShieldCheck,
    FileBarChart,
    FolderTree,
    Tag,
    FileType,
    Box,
    Ruler,
    Truck,
    Users,
    Package,
    Wrench,
    QrCode,
    ArrowRightLeft,
    FileWarning,
    Activity,
    FileClock,
    Settings,
    Shield,
    ShieldAlert,
    Plus,
    FileCheck,
    CalendarClock,
    Bell,
    Circle,
    CheckCircle2
} from 'lucide-react';

// Navigation structure with sections and collapsible groups
interface NavItem {
    label: string;
    href?: string;
    icon: LucideIcon;
    children?: NavItem[];
    badge?: number;
}

interface NavSection {
    section?: string; // Section header
    items: NavItem[];
}

// Function to get navigation sections based on user role
// Uses role-specific route prefixes: /admin/ for Admin, /staff/ for GSO Staff, /department_head/ for Department Head
function getNavSections(user: User, baseRoute: string, unreadCount: number): NavSection[] {
    const isAdmin = user.UserRoleID === 1;
    const isGSOStaff = user.UserRoleID === 2 || user.UserRoleID === 6;
    const isDepartmentHead = user.UserRoleID === 4;

    const allowedRoles = isAdmin ? ['admin'] : isDepartmentHead ? ['department_head'] : isGSOStaff ? ['staff'] : [];

    const ALL_SECTIONS: Array<NavSection & { roles?: ('admin' | 'staff' | 'department_head')[] }> = [
        {
            // MAIN - Everyone
            items: [
                { label: 'Dashboard', href: `${baseRoute}/dashboard`, icon: LayoutDashboard },
                { label: 'Notifications', href: `${baseRoute}/notifications`, icon: Bell, badge: unreadCount },
            ],
            roles: ['admin', 'staff', 'department_head'],
        },

        {
            section: 'DELIVERY',
            items: [
                { label: 'Delivery Receipts', href: `${baseRoute}/delivery-receipts`, icon: Truck },
            ],
            roles: ['admin', 'staff'],
        },
        {
            section: 'PROPERTY MANAGEMENT',
            items: isDepartmentHead
                ? [
                    {
                        label: 'Inventory',
                        icon: Box,
                        children: [
                            { label: 'Properties', href: `${baseRoute}/properties`, icon: FileType },
                            { label: 'Received Items', href: `${baseRoute}/received-items`, icon: Truck },


                        ]
                    },
                ]
                : [
                    {
                        label: 'Inventory',
                        icon: Box,
                        children: [
                            { label: 'Property Inventory', href: `${baseRoute}/inventory`, icon: Box },
                            { label: 'All Items', href: `${baseRoute}/inventory/all-items`, icon: Package },
                        ]
                    },
                ],
            roles: ['admin', 'staff', 'department_head'],
        },
        {
            section: 'ISSUANCE & ASSIGNMENT',
            items: isAdmin
                ? [
                    {
                        label: 'Property Issuance', icon: FileText, children: [
                            { label: 'For Issuance', href: `${baseRoute}/issuance`, icon: FileText },
                            { label: 'PAR Documents', href: `${baseRoute}/issuance/par`, icon: FileCheck },
                            { label: 'ICS Documents', href: `${baseRoute}/issuance/ics`, icon: FileText },
                            // { label: 'RSMI Reports', href: `${baseRoute}/rsmi`, icon: FileBarChart },
                            // { label: 'RIS Records', href: `${baseRoute}/ris`, icon: FileText },
                        ]
                    },
                ]
                : [
                    {
                        label: 'Property Issuance', icon: FileText, children: [
                            { label: 'Issuance Requests', href: `${baseRoute}/issuance`, icon: FileText },
                            { label: 'PAR Documents', href: `${baseRoute}/issuance/par`, icon: FileCheck },
                            { label: 'ICS Documents', href: `${baseRoute}/issuance/ics`, icon: FileText },
                            // { label: 'RSMI Reports', href: `${baseRoute}/rsmi`, icon: FileBarChart },
                        ]
                    },
                ],
            roles: ['admin', 'staff'],
        },
        {
            section: 'TRANSFER & DISPOSAL',
            items: [
                {
                    label: 'Transfer & Disposal', icon: ArrowRightLeft, children: [
                        { label: 'Property Transfer', href: `${baseRoute}/transfer`, icon: ArrowRightLeft },
                        { label: 'Property Borrowing', href: `${baseRoute}/borrow`, icon: CalendarClock },
                        ...((isAdmin || isGSOStaff) ? [
                            { label: 'RLSDDP Reports', href: `${baseRoute}/rlsddp`, icon: ShieldAlert },
                        ] : []),
                        ...((isAdmin || isGSOStaff) ? [
                            { label: 'IIRUP Reports', href: `${baseRoute}/iirup`, icon: FileWarning },
                        ] : []),
                    ]
                },
            ],
            roles: ['admin', 'staff', 'department_head'],
        },
        {
            section: 'MAINTENANCE',
            items: [
                { label: 'Service Records', href: `${baseRoute}/service-records`, icon: Wrench },
            ],
            roles: ['admin', 'staff', 'department_head'],
        },
        {
            section: 'QR MANAGEMENT',
            items: [
                {
                    label: 'QR Codes', icon: QrCode, children: [
                        // { label: 'Scan QR', href: `/qr/scan`, icon: QrCode },
                        { label: 'RPCPPE / RPCSEP', href: `/qr/rpc-inventory`, icon: ClipboardList },
                    ]
                },
            ],
            roles: ['admin', 'staff'],
        },
        {
            section: 'USER MANAGEMENT',
            items: [
                {
                    label: 'Users & Roles', icon: Users, children: [
                        { label: 'Users', href: `${baseRoute}/users`, icon: Users },
                        { label: 'Roles', href: `${baseRoute}/masterdata/user-roles`, icon: Shield },
                        { label: 'Departments', href: `${baseRoute}/masterdata/departments`, icon: Building2 },
                    ]
                },
            ],
            roles: ['admin'],
        },
        {
            section: 'MASTER DATA',
            items: [
                {
                    label: 'Configuration', icon: FolderTree, children: [
                        { label: 'Articles', href: `${baseRoute}/masterdata/articles`, icon: Package },
                        { label: 'Conditions', href: `${baseRoute}/masterdata/conditions`, icon: Activity },
                        { label: 'Disposal Methods', href: `${baseRoute}/masterdata/disposal-methods`, icon: Trash2 },
                        { label: 'Property Classifications', href: `${baseRoute}/masterdata/property-classifications`, icon: Tag },
                        { label: 'Property Types', href: `${baseRoute}/masterdata/property-types`, icon: Box },
                        { label: 'Property Status', href: `${baseRoute}/masterdata/property-statuses`, icon: Tag },
                        { label: 'Suppliers', href: `${baseRoute}/masterdata/suppliers`, icon: Truck },
                        { label: 'Repair Vendors', href: `${baseRoute}/masterdata/vendors`, icon: Wrench },
                        { label: 'Units of Measure', href: `${baseRoute}/masterdata/units-of-measure`, icon: Ruler },
                    ]
                },
            ],
            roles: ['admin'],
        },
        // {
        //     section: 'REPORTS',
        //     items: [
        //         {
        //             label: 'Reports', icon: FileBarChart, children: [
        //                 { label: 'Analytics', href: `${baseRoute}/reports/analytics`, icon: FileBarChart },
        //                 { label: 'Printable Forms', href: `${baseRoute}/reports/standard`, icon: FileText },
        //                 { label: 'Exports (CSV)', href: `${baseRoute}/reports/custom`, icon: FileText },
        //             ]
        //         },
        //     ],
        //     roles: ['admin', 'staff'],
        // },
        {
            section: 'SECURITY',
            items: [
                {
                    label: 'Security & Audit', icon: ShieldCheck, children: [
                        // { label: 'Turnstile', href: `${baseRoute}/security/turnstile`, icon: ShieldCheck },
                        { label: 'Login Audit', href: `${baseRoute}/security/login-audit`, icon: ShieldCheck },
                        { label: 'Activity Logs', href: `${baseRoute}/security/activity-logs`, icon: FileClock },
                        { label: 'Database Backups', href: `${baseRoute}/security/backups`, icon: FileCheck },
                        { label: 'Removed Items', href: `${baseRoute}/security/removed-items`, icon: Trash2 },
                        // { label: 'System Settings', href: `${baseRoute}/settings`, icon: Settings },
                    ]
                },
            ],
            roles: ['admin'],
        },
        {
            section: 'ACCOUNT',
            items: [
                { label: 'Settings', href: `${baseRoute}/settings`, icon: Settings },
            ],
            roles: ['admin', 'staff', 'department_head'],
        },
    ];

    return ALL_SECTIONS.filter((section) => {
        if (!section.roles) {
            return true;
        }
        return section.roles.some((role) => allowedRoles.includes(role));
    }).map(({ roles, ...section }) => section as NavSection);
}

// Collapsible menu item component
function MenuItem({ item, pathname }: { item: NavItem; pathname: string }) {
    const hasChildren = item.children && item.children.length > 0;
    const Icon = item.icon;

    // Initialize open state based on active child
    const [isOpen, setIsOpen] = useState(() => {
        if (hasChildren && item.children) {
            return item.children.some(
                (child) => child.href && pathname.startsWith(child.href)
            );
        }
        return false;
    });

    // Auto-open if any child is active
    useEffect(() => {
        if (hasChildren && item.children) {
            const hasActiveChild = item.children.some(
                (child) => child.href && pathname.startsWith(child.href)
            );
            if (hasActiveChild) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setIsOpen(true);
            }
        }
    }, [pathname, hasChildren, item.children]);

    if (hasChildren) {
        return (
            <div>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5" />
                        <span className="text-sm font-medium">{item.label}</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-0' : '-rotate-90'}`} />
                </button>
                <div
                    className={`ml-4 mt-1 grid overflow-hidden transition-all duration-300 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                        }`}
                >
                    <div className="min-h-0">
                        <div className="space-y-1 border-l-2 border-slate-300 pl-2 pb-1">
                            {item.children?.map((child) => {
                                // Check if any other child is an exact match for the current pathname
                                // This prevents "All PRs" from being active when "Create PR" is active
                                const isOtherChildActive = item.children?.some(c => c !== child && c.href === pathname);

                                const isExactMatch = pathname === child.href;
                                const isPrefixMatch = child.href ? pathname.startsWith(child.href + '/') : false;

                                const isActive = isExactMatch || (isPrefixMatch && !isOtherChildActive);

                                const ChildIcon = child.icon;
                                return (
                                    <a
                                        key={child.href}
                                        href={child.href}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${isActive
                                            ? 'bg-[var(--primary)] text-white font-medium'
                                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                            }`}
                                    >
                                        <ChildIcon className="w-4 h-4" />
                                        <span>{child.label}</span>
                                    </a>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
    return (
        <a
            href={item.href}
            className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive
                ? 'bg-[var(--primary)] text-white'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
        >
            <div className="flex items-center gap-3">
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
            </div>
            {item.badge && item.badge > 0 ? (
                <span className="flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-semibold h-5 min-w-[1.25rem] px-1">
                    {item.badge}
                </span>
            ) : null}
        </a>
    );
}

interface NotificationMenuItemProps {
    item: NavItem;
    defaultHref: string;
    menuOpen: boolean;
    notifications: NotificationItem[];
    menuLoading: boolean;
    actionLoading: boolean;
    panelTop: number;
    panelLeft: number;
    isMobile: boolean;
    onOpenMenu: (event: React.MouseEvent<HTMLElement>) => void;
    onCloseMenu: () => void;
    onReloadMenu: () => void;
    onOpenNotification: (notification: NotificationItem) => void;
    onMarkItemRead: (notificationId: number) => void;
    onDeleteItem: (notificationId: number) => void;
    onMarkLatestRead: () => void;
    onMarkAllRead: () => void;
    onDeleteAll: () => void;
}

const getNotificationHref = (notification: NotificationItem, defaultHref: string) => {
    const link = notification.payload?.link;

    if (typeof link === 'string' && link.trim().startsWith('/')) {
        return link;
    }

    return defaultHref;
};

function NotificationMenuItem({
    item,
    defaultHref,
    menuOpen,
    notifications,
    menuLoading,
    actionLoading,
    panelTop,
    panelLeft,
    isMobile,
    onOpenMenu,
    onCloseMenu,
    onReloadMenu,
    onOpenNotification,
    onMarkItemRead,
    onDeleteItem,
    onMarkLatestRead,
    onMarkAllRead,
    onDeleteAll,
}: NotificationMenuItemProps) {
    const Icon = item.icon;
    const unreadCount = notifications.filter((notification) => notification.read_at === null).length;

    return (
        <div className="relative" data-notification-trigger>
            <button
                type="button"
                onClick={(event) => onOpenMenu(event)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-colors ${menuOpen
                    ? 'bg-slate-200 text-slate-900'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
            >
                <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{item.label}</span>
                </div>
                <div className="flex items-center gap-1">
                    {item.badge && item.badge > 0 ? (
                        <span className="flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-semibold h-5 min-w-[1.25rem] px-1">
                            {item.badge}
                        </span>
                    ) : null}
                </div>
            </button>

            {menuOpen && typeof window !== 'undefined'
                ? createPortal(
                    <div
                        data-notification-panel
                        className={`fixed z-[120] rounded-2xl border border-slate-200/90 bg-white/95 shadow-2xl backdrop-blur-sm p-3 ${isMobile ? 'w-[calc(100vw-1.5rem)]' : 'w-[370px] max-w-[430px]'
                            }`}
                        style={{ top: panelTop, left: panelLeft }}
                    >
                        {!isMobile ? (
                            <div className="absolute -left-2 top-6 h-3 w-3 rotate-45 border-l border-t border-slate-200 bg-white/95" />
                        ) : null}

                        <div className="px-2 py-1.5 border-b border-slate-200 mb-3">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <div className="text-sm font-semibold text-slate-900">Notifications</div>
                                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                                        {unreadCount} unread
                                    </span>
                                </div>
                                <a
                                    href={item.href}
                                    onClick={onCloseMenu}
                                    className="text-xs font-medium text-[var(--primary)] hover:underline underline-offset-2"
                                >
                                    View all
                                </a>
                            </div>
                        </div>

                        <div className="max-h-80 overflow-y-auto px-1 pr-2">
                            {menuLoading ? (
                                <div className="space-y-2 py-1">
                                    {Array.from({ length: 4 }).map((_, idx) => (
                                        <div key={`notif-skeleton-${idx}`} className="rounded-xl border border-slate-200 bg-white p-3 animate-pulse">
                                            <div className="h-3 w-2/3 rounded bg-slate-200" />
                                            <div className="mt-2 h-2.5 w-full rounded bg-slate-200" />
                                            <div className="mt-1.5 h-2.5 w-4/5 rounded bg-slate-200" />
                                            <div className="mt-2 h-2 w-1/3 rounded bg-slate-200" />
                                        </div>
                                    ))}
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="py-5 text-sm text-slate-500 text-center">No notifications yet.</div>
                            ) : (
                                <div className="space-y-2">
                                    {notifications.map((notification) => {
                                        const isUnread = notification.read_at === null;
                                        const href = getNotificationHref(notification, defaultHref);

                                        return (
                                            <div
                                                key={notification.UserNotificationID}
                                                className={`rounded-xl border px-3 py-2.5 transition-colors ${isUnread
                                                    ? 'border-blue-200 bg-blue-50/50'
                                                    : 'border-slate-200 bg-white hover:bg-slate-50'
                                                    }`}
                                            >
                                                <a
                                                    href={href}
                                                    onClick={() => {
                                                        onCloseMenu();
                                                        onOpenNotification(notification);
                                                    }}
                                                    className="block"
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
                                                                {isUnread ? <Circle className="w-3 h-3 text-blue-500" /> : <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                                                                <span className="truncate">{notification.title}</span>
                                                            </div>
                                                            <p className="mt-1 text-xs text-slate-600 line-clamp-2">{notification.message}</p>
                                                            <p className="mt-1.5 text-[11px] text-slate-500">{new Date(notification.created_at).toLocaleString()}</p>
                                                        </div>
                                                    </div>
                                                </a>

                                                <div className="mt-2.5 flex items-center gap-2">
                                                    {isUnread ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => onMarkItemRead(notification.UserNotificationID)}
                                                            disabled={actionLoading}
                                                            className="text-[11px] rounded-md px-2.5 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                                                        >
                                                            Mark read
                                                        </button>
                                                    ) : null}
                                                    <button
                                                        type="button"
                                                        onClick={() => onDeleteItem(notification.UserNotificationID)}
                                                        disabled={actionLoading}
                                                        className="text-[11px] rounded-md px-2.5 py-1 text-red-600 hover:bg-red-50 disabled:opacity-50"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-200 grid grid-cols-2 gap-1.5">
                            <button
                                type="button"
                                onClick={() => {
                                    onMarkLatestRead();
                                }}
                                disabled={actionLoading}
                                className="text-left px-3 py-2 text-xs rounded-md hover:bg-slate-100 disabled:opacity-50"
                            >
                                Mark latest read
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    onMarkAllRead();
                                }}
                                disabled={actionLoading}
                                className="text-left px-3 py-2 text-xs rounded-md hover:bg-slate-100 disabled:opacity-50"
                            >
                                Mark all as read
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    onDeleteAll();
                                }}
                                disabled={actionLoading}
                                className="text-left px-3 py-2 text-xs rounded-md text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                                Delete all
                            </button>
                            <button
                                type="button"
                                onClick={onReloadMenu}
                                disabled={actionLoading || menuLoading}
                                className="text-left px-3 py-2 text-xs rounded-md hover:bg-slate-100 disabled:opacity-50"
                            >
                                Refresh
                            </button>
                        </div>
                    </div>,
                    document.body
                )
                : null}
        </div>
    );
}

interface SidebarProps {
    user: User;
    isOpen: boolean;
    onLogout: () => void;
    baseRoute: string;
}

export default function Sidebar({ user, isOpen, onLogout, baseRoute }: SidebarProps) {
    const pathname = usePathname();
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
    const [recentNotifications, setRecentNotifications] = useState<NotificationItem[]>([]);
    const [notificationMenuLoading, setNotificationMenuLoading] = useState(false);
    const [notificationActionLoading, setNotificationActionLoading] = useState(false);
    const [recentNotificationsLoaded, setRecentNotificationsLoaded] = useState(false);
    const [recentNotificationsLastLoadedAt, setRecentNotificationsLastLoadedAt] = useState<number>(0);
    const [menuPanelTop, setMenuPanelTop] = useState(96);
    const [menuPanelLeft, setMenuPanelLeft] = useState(280);
    const [isMobileMenu, setIsMobileMenu] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const fetchUnread = async () => {
            try {
                const unread = await getUnreadNotificationCount();
                if (!isMounted) return;

                setUnreadCount(unread);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                const isExpectedAuthError = /unauthenticated|unauthorized/i.test(message);
                const isNetworkFlap = /network error|err_network_changed/i.test(message);

                if (!isExpectedAuthError && !isNetworkFlap) {
                    console.warn('Failed to load unread count', error);
                }
            }
        };

        void fetchUnread();
        const interval = setInterval(fetchUnread, 30000); // refresh every 30s

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        const onDocumentClick = (event: MouseEvent) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;

            if (target.closest('[data-notification-panel]')) return;
            if (target.closest('[data-notification-trigger]')) return;

            setNotificationMenuOpen(false);
        };

        if (notificationMenuOpen) {
            document.addEventListener('mousedown', onDocumentClick);
        }

        return () => {
            document.removeEventListener('mousedown', onDocumentClick);
        };
    }, [notificationMenuOpen]);

    const openNotificationMenu = (event: React.MouseEvent<HTMLElement>) => {
        const targetRect = event.currentTarget.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const panelWidth = viewportWidth < 1024 ? viewportWidth - 24 : 360;
        const sidebarGap = 12;

        const mobile = viewportWidth < 1024;
        const nextLeft = mobile
            ? 12
            : Math.min(targetRect.right + sidebarGap, viewportWidth - panelWidth - 12);
        const nextTop = mobile
            ? Math.min(targetRect.bottom + 8, window.innerHeight - 420)
            : Math.max(12, Math.min(targetRect.top - 8, window.innerHeight - 500));

        setIsMobileMenu(mobile);
        setMenuPanelLeft(nextLeft);
        setMenuPanelTop(nextTop);
        setNotificationMenuOpen((prev) => !prev);
    };

    const loadRecentNotifications = async (showSkeleton = false) => {
        try {
            if (showSkeleton) {
                setNotificationMenuLoading(true);
            }
            const notifications = await listRecentNotifications(8);
            setRecentNotifications(notifications);
            setRecentNotificationsLoaded(true);
            setRecentNotificationsLastLoadedAt(Date.now());
        } catch (error) {
            console.error('Failed to load recent notifications', error);
            toast.error('Failed to load notifications.');
        } finally {
            if (showSkeleton) {
                setNotificationMenuLoading(false);
            }
        }
    };

    useEffect(() => {
        if (!notificationMenuOpen) return;

        if (!recentNotificationsLoaded) {
            void loadRecentNotifications(true);
            return;
        }

        const now = Date.now();
        const shouldRefreshInBackground = now - recentNotificationsLastLoadedAt > 30000;

        if (shouldRefreshInBackground) {
            void loadRecentNotifications(false);
        }
    }, [notificationMenuOpen, recentNotificationsLoaded, recentNotificationsLastLoadedAt]);

    const markLatestUnread = async () => {
        if (notificationActionLoading) return;

        setNotificationActionLoading(true);
        try {
            const notifications = await listRecentNotifications(15);
            const latestUnread = notifications.find((n) => n.read_at === null);

            if (!latestUnread) {
                toast.info('No unread notifications found.');
                return;
            }

            await markNotificationRead(latestUnread.UserNotificationID);
            setUnreadCount((prev) => Math.max(0, prev - 1));
            setRecentNotifications((prev) =>
                prev.map((item) =>
                    item.UserNotificationID === latestUnread.UserNotificationID
                        ? { ...item, read_at: new Date().toISOString() }
                        : item
                )
            );
            toast.success('Latest unread notification marked as read.');
        } catch (error) {
            console.error('Failed to mark latest unread notification as read', error);
            toast.error('Failed to mark notification as read.');
        } finally {
            setNotificationActionLoading(false);
        }
    };

    const markAllUnread = async () => {
        if (notificationActionLoading) return;

        setNotificationActionLoading(true);
        try {
            await markAllNotificationsRead();
            setUnreadCount(0);
            setRecentNotifications((prev) => prev.map((item) => ({ ...item, read_at: new Date().toISOString() })));
            toast.success('All notifications marked as read.');
        } catch (error) {
            console.error('Failed to mark all notifications as read', error);
            toast.error('Failed to mark all notifications as read.');
        } finally {
            setNotificationActionLoading(false);
        }
    };

    const removeAllNotifications = async () => {
        if (notificationActionLoading) return;

        const confirmed = window.confirm('Delete all notifications? This cannot be undone.');
        if (!confirmed) return;

        setNotificationActionLoading(true);
        try {
            await deleteAllNotifications();
            setUnreadCount(0);
            setRecentNotifications([]);
            toast.success('All notifications deleted.');
        } catch (error) {
            console.error('Failed to delete all notifications', error);
            toast.error('Failed to delete all notifications.');
        } finally {
            setNotificationActionLoading(false);
        }
    };

    const markOneNotificationRead = async (notificationId: number) => {
        if (notificationActionLoading) return;

        setNotificationActionLoading(true);
        try {
            await markNotificationRead(notificationId);
            setRecentNotifications((prev) =>
                prev.map((item) =>
                    item.UserNotificationID === notificationId
                        ? { ...item, read_at: new Date().toISOString() }
                        : item
                )
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Failed to mark notification as read', error);
            toast.error('Failed to mark notification as read.');
        } finally {
            setNotificationActionLoading(false);
        }
    };

    const deleteOneNotification = async (notificationId: number) => {
        if (notificationActionLoading) return;

        setNotificationActionLoading(true);
        try {
            const target = recentNotifications.find((item) => item.UserNotificationID === notificationId);
            await deleteNotification(notificationId);
            setRecentNotifications((prev) => prev.filter((item) => item.UserNotificationID !== notificationId));
            if (target?.read_at === null) {
                setUnreadCount((prev) => Math.max(0, prev - 1));
            }
            toast.success('Notification deleted.');
        } catch (error) {
            console.error('Failed to delete notification', error);
            toast.error('Failed to delete notification.');
        } finally {
            setNotificationActionLoading(false);
        }
    };

    const handleOpenNotification = (notification: NotificationItem) => {
        if (notification.read_at === null) {
            void markOneNotificationRead(notification.UserNotificationID);
        }
    };

    return (
        <aside className={`w-64 bg-white text-slate-900 flex flex-col fixed h-screen z-40 transition-transform duration-300 lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'
            }`}>
            {/* Header Image - Fixed at top - Hidden on mobile */}
            <div className="h-32 border-b border-slate-200 flex-shrink-0 hidden lg:block" style={{ backgroundImage: "url('/assets/images/background/sidebar.jpg')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}>
            </div>

            {/* Navigation - Scrollable content area */}
            <nav className="flex-1 overflow-y-auto px-4 py-2 scrollbar-thin">
                {getNavSections(user, baseRoute, unreadCount).map((section, sectionIndex) => (
                    <div key={sectionIndex} className="mb-4">
                        {section.section && (
                            <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                {section.section}
                            </div>
                        )}
                        <div className="space-y-1">
                            {section.items.map((item, itemIndex) => (
                                item.label === 'Notifications' ? (
                                    <NotificationMenuItem
                                        key={item.label + itemIndex}
                                        item={item}
                                        defaultHref={`${baseRoute}/notifications`}
                                        menuOpen={notificationMenuOpen}
                                        notifications={recentNotifications}
                                        menuLoading={notificationMenuLoading}
                                        actionLoading={notificationActionLoading}
                                        panelTop={menuPanelTop}
                                        panelLeft={menuPanelLeft}
                                        isMobile={isMobileMenu}
                                        onOpenMenu={openNotificationMenu}
                                        onCloseMenu={() => setNotificationMenuOpen(false)}
                                        onReloadMenu={() => void loadRecentNotifications(recentNotifications.length === 0)}
                                        onOpenNotification={handleOpenNotification}
                                        onMarkItemRead={markOneNotificationRead}
                                        onDeleteItem={deleteOneNotification}
                                        onMarkLatestRead={markLatestUnread}
                                        onMarkAllRead={markAllUnread}
                                        onDeleteAll={removeAllNotifications}
                                    />
                                ) : (
                                    <MenuItem key={item.label + itemIndex} item={item} pathname={pathname} />
                                )
                            ))}
                        </div>
                    </div>
                ))}
            </nav>

            {/* User Info & Logout - Fixed at bottom */}
            <div className="p-4 border-t border-slate-200 flex-shrink-0">
                <div className="mb-3">
                    <p className="text-sm font-medium text-slate-900 truncate" title={user.FullName || user.Username}>
                        {user.FullName || user.Username}
                    </p>
                    <p className="text-xs text-slate-500">{user.Role}</p>
                    <p className="text-xs text-slate-600 truncate" title={user.Department}>
                        {user.Department}
                    </p>
                </div>
                <button
                    onClick={onLogout}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                >
                    <LogOut className="w-4 h-4" />
                    Logout
                </button>
            </div>
        </aside>
    );
}

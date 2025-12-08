'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { showConfirmDialog } from '@/lib/utils/confirm';
import {
    LayoutDashboard,
    Users,
    Boxes,
    Package,
    BarChart3,
    Settings,
    LogOut,
    LucideIcon,
    ChevronDown,
    ChevronRight,
    FileText,
    ClipboardList,
    PackagePlus,
    UserPlus,
    Building2,
    Tags,
    RefreshCw,
    Trash2,
    QrCode,
    Scan,
    ShieldCheck,
    FileBarChart,
    Wrench,
    FolderTree,
} from 'lucide-react';

// Navigation structure with sections and collapsible groups
interface NavItem {
    label: string;
    href?: string;
    icon: LucideIcon;
    children?: NavItem[];
}

interface NavSection {
    section?: string; // Section header
    items: NavItem[];
}

const navSections: NavSection[] = [
    // MAIN
    {
        items: [
            {
                label: 'Dashboard',
                href: '/admin/dashboard',
                icon: LayoutDashboard
            },
        ],
    },

    // PROCUREMENT WORKFLOW
    {
        section: 'PROCUREMENT',
        items: [
            {
                label: 'Purchase Requests',
                icon: FileText,
                children: [
                    { label: 'All PRs', href: '/admin/purchase-requests', icon: FileText },
                    { label: 'Create PR', href: '/admin/purchase-requests/new', icon: PackagePlus },
                    { label: 'Pending Approval', href: '/admin/purchase-requests/pending', icon: ClipboardList },
                ],
            },
            {
                label: 'Purchase Orders',
                icon: ClipboardList,
                children: [
                    { label: 'All POs', href: '/admin/purchase-orders', icon: ClipboardList },
                    { label: 'Create PO', href: '/admin/purchase-orders/new', icon: PackagePlus },
                ],
            },
            {
                label: 'Delivery & Inspection',
                icon: PackagePlus,
                children: [
                    { label: 'Delivery Receipts', href: '/admin/delivery-receipts', icon: PackagePlus },
                    { label: 'IAR', href: '/admin/inspection-reports', icon: FileBarChart },
                ],
            },
        ],
    },

    // INVENTORY & PROPERTY
    {
        section: 'INVENTORY',
        items: [
            {
                label: 'Property Inventory',
                icon: Boxes,
                children: [
                    { label: 'All Properties', href: '/admin/properties', icon: Package },
                    { label: 'Add Property', href: '/admin/properties/new', icon: PackagePlus },
                ],
            },
            {
                label: 'Master Data',
                icon: FolderTree,
                children: [
                    { label: 'Property Types', href: '/admin/property-types', icon: Tags },
                    { label: 'Categories', href: '/admin/categories', icon: FolderTree },
                ],
            },
        ],
    },

    // DISTRIBUTION
    {
        section: 'DISTRIBUTION',
        items: [
            {
                label: 'Issuance',
                icon: PackagePlus,
                children: [
                    { label: 'Property Issuance', href: '/admin/issuance', icon: PackagePlus },
                    { label: 'Property Assignment', href: '/admin/assignments', icon: UserPlus },
                ],
            },
            {
                label: 'Accountability',
                icon: FileText,
                children: [
                    { label: 'PAR (PPE)', href: '/admin/par', icon: FileText },
                    { label: 'ICS (Semi-Expendable)', href: '/admin/ics', icon: FileText },
                ],
            },
        ],
    },

    // MONITORING & MAINTENANCE
    {
        section: 'MONITORING',
        items: [
            {
                label: 'QR Management',
                icon: QrCode,
                children: [
                    { label: 'Generate QR Codes', href: '/admin/qr-generate', icon: QrCode },
                    { label: 'Scan Property', href: '/admin/qr-scan', icon: Scan },
                ],
            },
            {
                label: 'Physical Count',
                icon: ClipboardList,
                children: [
                    { label: 'Count Sessions', href: '/admin/physical-count', icon: ClipboardList },
                    { label: 'Start New Count', href: '/admin/physical-count/new', icon: PackagePlus },
                ],
            },
            {
                label: 'Job Orders',
                icon: Wrench,
                children: [
                    { label: 'All Job Orders', href: '/admin/job-orders', icon: Wrench },
                    { label: 'Create Job Order', href: '/admin/job-orders/new', icon: PackagePlus },
                ],
            },
        ],
    },

    // TRANSFER & DISPOSAL
    {
        section: 'DISPOSAL',
        items: [
            {
                label: 'Property Transfer',
                icon: RefreshCw,
                children: [
                    { label: 'All Transfers', href: '/admin/transfers', icon: RefreshCw },
                    { label: 'New Transfer', href: '/admin/transfers/new', icon: PackagePlus },
                ],
            },
            {
                label: 'Property Disposal',
                icon: Trash2,
                children: [
                    { label: 'Disposal Records', href: '/admin/disposal', icon: Trash2 },
                    { label: 'IIRUP', href: '/admin/iirup', icon: FileBarChart },
                ],
            },
        ],
    },

    // ADMINISTRATION
    {
        section: 'ADMINISTRATION',
        items: [
            {
                label: 'User Management',
                icon: Users,
                children: [
                    { label: 'Users', href: '/admin/users', icon: Users },
                    { label: 'Departments', href: '/admin/departments', icon: Building2 },
                    { label: 'Suppliers', href: '/admin/suppliers', icon: Building2 },
                ],
            },
            {
                label: 'Reports',
                icon: BarChart3,
                children: [
                    { label: 'Analytics', href: '/admin/reports/analytics', icon: BarChart3 },
                    { label: 'Standard Reports', href: '/admin/reports', icon: FileText },
                ],
            },
            {
                label: 'Security',
                icon: ShieldCheck,
                children: [
                    { label: 'Login Audit', href: '/admin/security', icon: ShieldCheck },
                    { label: 'Activity Logs', href: '/admin/activity-logs', icon: FileText },
                ],
            },
        ],
    },
];

// Collapsible menu item component
function MenuItem({ item, pathname }: { item: NavItem; pathname: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const hasChildren = item.children && item.children.length > 0;
    const Icon = item.icon;

    // Auto-open if any child is active
    useEffect(() => {
        if (hasChildren && item.children) {
            const hasActiveChild = item.children.some(
                (child) => child.href && pathname.startsWith(child.href)
            );
            if (hasActiveChild) setIsOpen(true);
        }
    }, [pathname, hasChildren, item.children]);

    if (hasChildren) {
        return (
            <div>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5" />
                        <span className="text-sm font-medium">{item.label}</span>
                    </div>
                    {isOpen ? (
                        <ChevronDown className="w-4 h-4" />
                    ) : (
                        <ChevronRight className="w-4 h-4" />
                    )}
                </button>
                {isOpen && (
                    <div className="ml-4 mt-1 space-y-1 border-l-2 border-slate-700 pl-2">
                        {item.children?.map((child) => {
                            const isActive = pathname === child.href || pathname.startsWith(child.href + '/');
                            const ChildIcon = child.icon;
                            return (
                                <a
                                    key={child.href}
                                    href={child.href}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${isActive
                                        ? 'bg-[var(--primary)] text-white font-medium'
                                        : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                                        }`}
                                >
                                    <ChildIcon className="w-4 h-4" />
                                    <span>{child.label}</span>
                                </a>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
    return (
        <a
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive
                ? 'bg-[var(--primary)] text-white'
                : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
        >
            <Icon className="w-5 h-5" />
            <span className="text-sm font-medium">{item.label}</span>
        </a>
    );
}

// Skeleton loader while checking auth
function DashboardSkeleton() {
    return (
        <div className="min-h-screen bg-slate-900 flex">
            {/* Sidebar skeleton */}
            <div className="w-64 bg-slate-800 p-4 space-y-4">
                <div className="h-10 bg-slate-700/50 rounded animate-pulse" />
                <div className="space-y-2">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="h-10 bg-slate-700/50 rounded animate-pulse" />
                    ))}
                </div>
            </div>
            {/* Main content skeleton */}
            <div className="flex-1 p-6 space-y-6">
                <div className="h-10 w-48 bg-slate-700/50 rounded animate-pulse" />
                <div className="grid grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-32 bg-slate-700/50 rounded-lg animate-pulse" />
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, loading, logout } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // Not authenticated - redirect to login
        if (!loading && !user) {
            router.push('/');
            return;
        }

        // Wrong role - redirect to their dashboard
        if (!loading && user && user.Role.toLowerCase() !== 'admin') {
            const roleRoutes: Record<string, string> = {
                'gso staff': '/staff/dashboard',
                'property custodian': '/custodian/dashboard',
                'department head': '/department/dashboard',
                'end user': '/user/dashboard',
            };
            const correctRoute = roleRoutes[user.Role.toLowerCase()] || '/';
            router.push(correctRoute);
        }
    }, [loading, user, router]);

    const handleLogout = () => {
        showConfirmDialog({
            title: 'Logout Confirmation',
            description: 'Are you sure you want to logout?',
            confirmText: 'Logout',
            cancelText: 'Cancel',
            onConfirm: logout,
        });
    };

    // Show skeleton while loading or if wrong role
    if (loading || !user || user.Role.toLowerCase() !== 'admin') {
        return <DashboardSkeleton />;
    }

    return (
        <div className="min-h-screen bg-slate-100 flex">
            {/* Sidebar - Fixed, Non-scrollable */}
            <aside className="w-64 bg-slate-800 text-white flex flex-col fixed h-screen">
                {/* Logo/Brand - Fixed at top */}
                <div className="p-4 border-b border-slate-700 flex-shrink-0">
                    <h1 className="text-xl font-bold text-[var(--primary)]">IAMS-GSO</h1>
                    <p className="text-xs text-slate-400 mt-1">El Salvador City</p>
                </div>

                {/* Navigation - Scrollable content area */}
                <nav className="flex-1 overflow-y-auto px-4 py-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-800">
                    {navSections.map((section, sectionIndex) => (
                        <div key={sectionIndex} className="mb-4">
                            {section.section && (
                                <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    {section.section}
                                </div>
                            )}
                            <div className="space-y-1">
                                {section.items.map((item, itemIndex) => (
                                    <MenuItem key={item.label + itemIndex} item={item} pathname={pathname} />
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* User Info & Logout - Fixed at bottom */}
                <div className="p-4 border-t border-slate-700 flex-shrink-0">
                    <div className="mb-3">
                        <p className="text-sm font-medium text-white truncate" title={user.FullName || user.Username}>
                            {user.FullName || user.Username}
                        </p>
                        <p className="text-xs text-slate-400">{user.Role}</p>
                        <p className="text-xs text-slate-500 truncate" title={user.Department}>
                            {user.Department}
                        </p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content - Offset by sidebar width */}
            <main className="flex-1 ml-64 overflow-auto">
                {children}
            </main>
        </div>
    );
}

'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { User } from '@/types/auth';
import {
    LayoutDashboard,
    LogOut,
    LucideIcon,
    ChevronDown,
    ChevronRight,
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
    Briefcase,
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
    Plus,
    FileCheck
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

// Function to get navigation sections based on user role
// Uses role-specific route prefixes: /admin/ for Admin, /staff/ for GSO Staff, /department_head/ for Department Head
function getNavSections(user: User, baseRoute: string): NavSection[] {
    const isAdmin = user.UserRoleID === 1;
    const isGSOStaff = user.UserRoleID === 2;
    const isDepartmentHead = user.UserRoleID === 4;

    const sections: NavSection[] = [
        // MAIN - Everyone sees dashboard
        {
            items: [
                {
                    label: 'Dashboard',
                    href: `${baseRoute}/dashboard`,
                    icon: LayoutDashboard
                },
            ],
        },
    ];

    // 🔴 ADMIN (Full System Access)
    if (isAdmin) {
        sections.push(
            {
                section: 'DELIVERY & INSPECTION',
                items: [
                    {
                        label: 'Delivery & Inspection',
                        icon: Truck,
                        children: [
                            { label: 'Delivery Receipts', href: `${baseRoute}/delivery-receipts`, icon: Truck },
                            { label: 'Inspection Reports', href: `${baseRoute}/inspection-acceptance-reports`, icon: ClipboardList },
                        ]
                    }
                ]
            },
            {
                section: 'PROPERTY MANAGEMENT',
                items: [
                    {
                        label: 'Inventory',
                        icon: Box,
                        children: [
                            { label: 'Property Inventory', href: `${baseRoute}/inventory`, icon: Box },
                            { label: 'All Items', href: `${baseRoute}/inventory/all-items`, icon: Package },
                            { label: 'Property Types', href: `${baseRoute}/masterdata/property-types`, icon: FileType },
                            { label: 'Property Status', href: `${baseRoute}/masterdata/property-statuses`, icon: Tag },
                        ]
                    }
                ]
            },
            {
                section: 'ISSUANCE & ASSIGNMENT',
                items: [
                    {
                        label: 'Asset Requests',
                        icon: FileText,
                        children: [
                            { label: 'All Requests', href: `${baseRoute}/asset-requests`, icon: FileText },
                        ]
                    },
                    {
                        label: 'Property Issuance',
                        icon: FileText,
                        children: [
                            { label: 'Issuance Requests', href: `${baseRoute}/issuance`, icon: FileText },
                            { label: 'PAR Documents', href: `${baseRoute}/issuance/par`, icon: FileCheck },
                            { label: 'ICS Documents', href: `${baseRoute}/issuance/ics`, icon: FileText },
                        ]
                    }
                ]
            },
            {
                section: 'TRANSFER & DISPOSAL',
                items: [
                    {
                        label: 'Transfer & Disposal',
                        icon: ArrowRightLeft,
                        children: [
                            { label: 'Property Transfer', href: `${baseRoute}/transfer`, icon: ArrowRightLeft },
                            { label: 'Property Disposal', href: `${baseRoute}/disposal`, icon: Trash2 },
                            { label: 'IIRUP', href: `${baseRoute}/iirup`, icon: FileWarning },
                        ]
                    }
                ]
            },
            {
                section: 'MAINTENANCE',
                items: [
                    { label: 'Job Orders', href: `${baseRoute}/job-orders`, icon: Wrench }
                ]
            },
            {
                section: 'PHYSICAL INVENTORY',
                items: [
                    {
                        label: 'Physical Count',
                        icon: ClipboardList,
                        children: [
                            { label: 'Count Sessions', href: `${baseRoute}/physical-count/sessions`, icon: ClipboardList },
                            { label: 'Count Records', href: `${baseRoute}/physical-count/records`, icon: FileBarChart },
                        ]
                    }
                ]
            },
            {
                section: 'QR MANAGEMENT',
                items: [
                    {
                        label: 'QR Codes',
                        icon: QrCode,
                        children: [
                            { label: 'Generate QR', href: `/qr/generate`, icon: QrCode },
                            { label: 'Scan QR', href: `/qr/scan`, icon: QrCode },
                        ]
                    }
                ]
            },
            {
                section: 'USER MANAGEMENT',
                items: [
                    {
                        label: 'Users & Roles',
                        icon: Users,
                        children: [
                            { label: 'Users', href: `${baseRoute}/users`, icon: Users },
                            { label: 'Roles', href: `${baseRoute}/masterdata/user-roles`, icon: Shield },
                            { label: 'Departments', href: `${baseRoute}/masterdata/departments`, icon: Building2 },
                            { label: 'Positions', href: `${baseRoute}/masterdata/positions`, icon: Briefcase },
                        ]
                    }
                ]
            },
            {
                section: 'MASTER DATA',
                items: [
                    {
                        label: 'Configuration',
                        icon: FolderTree,
                        children: [
                            { label: 'Suppliers', href: `${baseRoute}/masterdata/suppliers`, icon: Truck },
                            { label: 'End Users', href: `${baseRoute}/masterdata/end-users`, icon: Users },
                            { label: 'Categories', href: `${baseRoute}/masterdata/categories`, icon: FolderTree },
                            { label: 'Classifications', href: `${baseRoute}/masterdata/classifications`, icon: Tag },
                            { label: 'Conditions', href: `${baseRoute}/masterdata/conditions`, icon: Activity },
                            { label: 'Units of Measure', href: `${baseRoute}/masterdata/units-of-measure`, icon: Ruler },
                            { label: 'Disposal Methods', href: `${baseRoute}/masterdata/disposal-methods`, icon: Trash2 },
                        ]
                    }
                ]
            },
            {
                section: 'REPORTS',
                items: [
                    {
                        label: 'Reports',
                        icon: FileBarChart,
                        children: [
                            { label: 'Analytics', href: `${baseRoute}/reports/analytics`, icon: FileBarChart },
                            { label: 'Printable Forms', href: `${baseRoute}/reports/standard`, icon: FileText },
                            { label: 'Exports (CSV)', href: `${baseRoute}/reports/custom`, icon: FileText },
                        ]
                    }
                ]
            },
            {
                section: 'SECURITY',
                items: [
                    {
                        label: 'Security & Audit',
                        icon: ShieldCheck,
                        children: [
                            { label: 'Login Audit', href: `${baseRoute}/security/login-audit`, icon: ShieldCheck },
                            { label: 'Activity Logs', href: `${baseRoute}/security/activity-logs`, icon: FileClock },
                            { label: 'System Settings', href: `${baseRoute}/settings`, icon: Settings },
                        ]
                    }
                ]
            }
        );
    }

    // 🟡 GSO STAFF (Operational Level)
    if (isGSOStaff) {
        sections.push(
            {
                section: 'PROPERTY MANAGEMENT',
                items: [
                    { label: 'Property Inventory', href: `${baseRoute}/inventory`, icon: Box },
                    { label: 'Property Details', href: `${baseRoute}/property-details`, icon: FileText },
                ]
            },
            {
                section: 'DELIVERY & INSPECTION',
                items: [
                    {
                        label: 'Delivery & Inspection',
                        icon: Truck,
                        children: [
                            { label: 'Delivery Receipts', href: `${baseRoute}/delivery-receipts`, icon: Truck },
                            { label: 'Inspection Reports', href: `${baseRoute}/inspection-acceptance-reports`, icon: ClipboardList },
                        ]
                    }
                ]
            },
            {
                section: 'ISSUANCE & DISTRIBUTION',
                items: [
                    {
                        label: 'Property Issuance',
                        icon: FileText,
                        children: [
                            { label: 'Issuance Requests', href: `${baseRoute}/issuance`, icon: FileText },
                            { label: 'Create Request', href: `${baseRoute}/issuance/new`, icon: Plus },
                            { label: 'PAR Documents', href: `${baseRoute}/issuance/par`, icon: FileCheck },
                            { label: 'ICS Documents', href: `${baseRoute}/issuance/ics`, icon: FileText },
                        ]
                    }
                ]
            },
            {
                section: 'OPERATIONS',
                items: [
                    { label: 'Property Transfer', href: `${baseRoute}/transfer`, icon: ArrowRightLeft },
                    { label: 'Job Orders', href: `${baseRoute}/job-orders`, icon: Wrench },
                    { label: 'Physical Count', href: `${baseRoute}/physical-count`, icon: ClipboardList },
                ]
            },
            {
                section: 'QR OPERATIONS',
                items: [
                    {
                        label: 'QR Management',
                        icon: QrCode,
                        children: [
                            { label: 'Generate QR', href: `/qr/generate`, icon: QrCode },
                            { label: 'Scan QR', href: `/qr/scan`, icon: QrCode },
                        ]
                    }
                ]
            },
            {
                section: 'REPORTS',
                items: [
                    { label: 'View Reports', href: `${baseRoute}/reports`, icon: FileBarChart },
                    { label: 'Quick Reports', href: `${baseRoute}/reports/quick`, icon: FileText },
                ]
            },
            {
                section: 'MASTER DATA',
                items: [
                    {
                        label: 'Master Data',
                        icon: FolderTree,
                        children: [
                            { label: 'Suppliers', href: `${baseRoute}/masterdata/suppliers`, icon: Truck },
                            { label: 'End Users', href: `${baseRoute}/masterdata/end-users`, icon: Users },
                        ]
                    }
                ]
            }
        );
    }

    // 🟢 DEPARTMENT HEAD (Limited Property Oversight)
    if (isDepartmentHead) {
        sections.push(
            {
                section: 'PROPERTY OVERSIGHT',
                items: [
                    { label: 'Property Oversight', href: `${baseRoute}/properties`, icon: Building2 },
                ]
            },
            {
                section: 'ACCOUNTABILITY DOCUMENTS',
                items: [
                    {
                        label: 'Issued Documents',
                        icon: FileText,
                        children: [
                            { label: 'All Issuances', href: `${baseRoute}/issuance`, icon: FileText },
                            { label: 'PAR Documents', href: `${baseRoute}/issuance/par`, icon: FileCheck },
                            { label: 'ICS Documents', href: `${baseRoute}/issuance/ics`, icon: FileText },
                        ]
                    }
                ]
            },
            {
                section: 'VERIFICATION',
                items: [
                    { label: 'Scan & Verify (QR)', href: `/qr/scan`, icon: QrCode },
                ]
            },
            {
                section: 'ASSET REQUESTS',
                items: [
                    {
                        label: 'Asset Requests',
                        icon: FileText,
                        children: [
                            { label: 'My Requests', href: `${baseRoute}/asset-requests`, icon: FileText },
                            { label: 'Create Request', href: `${baseRoute}/asset-requests/new`, icon: Plus },
                        ]
                    }
                ]
            },
            {
                section: 'REPORTS',
                items: [
                    // Keep reports minimal until role-specific reporting is implemented.
                    { label: 'Issuance Documents', href: `${baseRoute}/issuance`, icon: FileBarChart },
                ]
            }
        );
    }

    return sections;
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
                    {isOpen ? (
                        <ChevronDown className="w-4 h-4" />
                    ) : (
                        <ChevronRight className="w-4 h-4" />
                    )}
                </button>
                {isOpen && (
                    <div className="ml-4 mt-1 space-y-1 border-l-2 border-slate-300 pl-2">
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
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
        >
            <Icon className="w-5 h-5" />
            <span className="text-sm font-medium">{item.label}</span>
        </a>
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

    return (
        <aside className={`w-64 bg-white text-slate-900 flex flex-col fixed h-screen z-40 transition-transform duration-300 lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'
            }`}>
            {/* Header Image - Fixed at top - Hidden on mobile */}
            <div className="h-32 border-b border-slate-200 flex-shrink-0 hidden lg:block" style={{ backgroundImage: "url('/assets/images/background/sidebar.jpg')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}>
            </div>

            {/* Navigation - Scrollable content area */}
            <nav className="flex-1 overflow-y-auto px-4 py-2 scrollbar-thin">
                {getNavSections(user, baseRoute).map((section, sectionIndex) => (
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

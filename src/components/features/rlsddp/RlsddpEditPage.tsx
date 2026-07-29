'use client';

import { useEffect, useState, useCallback, useMemo, useRef, Fragment } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Building2, AlertCircle, ShieldAlert, ChevronDown, ChevronRight, Check, ChevronLeft, Trash2, PackageCheck } from 'lucide-react';
import { toast } from 'sonner';
import { rlsddpAPI } from '@/lib/api/rlsddp';
import { DepartmentAsset, PropertyRlsddpReport, RlsddpStatus, AccountableOfficerOption } from '@/types/propertyRlsddp';
import { TransferDepartment } from '@/types/propertyTransfer';

interface RlsddpEditPageProps {
    baseRoute: string;
}

interface AssetGroup {
    groupKey: string;
    parNumber: string;
    description: string;
    acquisitionCost: number;
    items: DepartmentAsset[];
}

export function RlsddpEditPage({ baseRoute }: RlsddpEditPageProps) {
    const router = useRouter();
    const params = useParams();
    const id = Number(params?.id);

    const [report, setReport] = useState<PropertyRlsddpReport | null>(null);
    const [departments, setDepartments] = useState<TransferDepartment[]>([]);
    const [selectedDeptId, setSelectedDeptId] = useState<number | ''>('');
    const [deptSearchQuery, setDeptSearchQuery] = useState('');
    const [deptComboboxOpen, setDeptComboboxOpen] = useState(false);
    const deptComboboxRef = useRef<HTMLDivElement | null>(null);

    const [officerOptions, setOfficerOptions] = useState<AccountableOfficerOption[]>([]);
    const [selectedOfficerKey, setSelectedOfficerKey] = useState<string>('');

    const [status, setStatus] = useState<RlsddpStatus>('Lost');
    const [policeNotified, setPoliceNotified] = useState(false);
    const [policeStation, setPoliceStation] = useState('');
    const [dateReported, setDateReported] = useState('');
    const [remarks, setRemarks] = useState('');

    const [availableAssets, setAvailableAssets] = useState<DepartmentAsset[]>([]);
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<number>>(new Set());
    const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(new Set());
    const [expandedDescKeys, setExpandedDescKeys] = useState<Set<string>>(new Set());

    // Pagination for Section 3 (25 rows per page)
    const [currentPage, setCurrentPage] = useState<number>(1);
    const ITEMS_PER_PAGE = 25;

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const fetchAssetsForOfficer = useCallback(async (deptId: number, officer: AccountableOfficerOption) => {
        try {
            const assetsData = await rlsddpAPI.getDepartmentAssets(deptId, {
                officer: officer.name,
                officer_type: officer.type,
            });
            setAvailableAssets(assetsData || []);
            setCurrentPage(1);
        } catch {
            toast.error('Failed to load assets for officer');
        }
    }, []);

    const loadData = useCallback(async () => {
        if (!id) return;
        try {
            setLoading(true);
            const [rep, depts] = await Promise.all([
                rlsddpAPI.getReport(id),
                rlsddpAPI.getDepartments(),
            ]);

            setReport(rep);
            setDepartments(depts || []);
            setSelectedDeptId(rep.DepartmentID);
            setDeptSearchQuery(rep.department?.DepartmentName || '');
            setStatus(rep.Status);
            setPoliceNotified(rep.PoliceNotified);
            setPoliceStation(rep.PoliceStation || '');
            setDateReported(rep.DateReported ? rep.DateReported.substring(0, 10) : '');
            setRemarks(rep.Remarks || '');

            const itemIds = new Set<number>();
            rep.items?.forEach((item) => {
                itemIds.add(item.InventoryDetailID);
            });
            setSelectedAssetIds(itemIds);

            // Fetch Officer list
            const officerRes = await rlsddpAPI.getAccountableOfficers(rep.DepartmentID);
            const list = officerRes?.accountable_officers || [];
            setOfficerOptions(list);

            const existingOfficer = list.find((o) => o.name === rep.AccountableOfficer) || {
                name: rep.AccountableOfficer,
                label: rep.AccountableOfficer,
                source: 'Existing',
                type: 'department_head',
            };
            const key = `${existingOfficer.type}:${existingOfficer.name}`;
            setSelectedOfficerKey(key);

            await fetchAssetsForOfficer(rep.DepartmentID, existingOfficer);
        } catch {
            toast.error('Failed to load RLSDDP report details');
        } finally {
            setLoading(false);
        }
    }, [id, fetchAssetsForOfficer]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        const onClickOutside = (e: MouseEvent) => {
            if (deptComboboxRef.current && !deptComboboxRef.current.contains(e.target as Node)) {
                setDeptComboboxOpen(false);
            }
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    const filteredDepartments = useMemo(() => {
        if (!deptSearchQuery.trim()) return departments;
        const q = deptSearchQuery.toLowerCase();
        return departments.filter(
            (d) =>
                d.DepartmentName.toLowerCase().includes(q) ||
                (d.DepartmentCode && d.DepartmentCode.toLowerCase().includes(q))
        );
    }, [departments, deptSearchQuery]);

    const handleDepartmentChange = async (dept: TransferDepartment) => {
        setSelectedDeptId(dept.DepartmentID);
        setDeptSearchQuery(dept.DepartmentName);
        setDeptComboboxOpen(false);
        setSelectedAssetIds(new Set());
        setExpandedGroupKeys(new Set());
        setExpandedDescKeys(new Set());
        setCurrentPage(1);

        try {
            const officerRes = await rlsddpAPI.getAccountableOfficers(dept.DepartmentID);
            const list = officerRes?.accountable_officers || [];
            setOfficerOptions(list);

            if (list.length > 0) {
                const defaultOff = list[0];
                setSelectedOfficerKey(`${defaultOff.type}:${defaultOff.name}`);
                await fetchAssetsForOfficer(dept.DepartmentID, defaultOff);
            } else {
                setSelectedOfficerKey('');
                setAvailableAssets([]);
            }
        } catch {
            toast.error('Failed to update department officers');
        }
    };

    const handleOfficerSelectChange = async (key: string) => {
        setSelectedOfficerKey(key);
        const found = officerOptions.find((o) => `${o.type}:${o.name}` === key);
        if (found && selectedDeptId) {
            setSelectedAssetIds(new Set());
            setExpandedGroupKeys(new Set());
            setExpandedDescKeys(new Set());
            setCurrentPage(1);
            await fetchAssetsForOfficer(Number(selectedDeptId), found);
        }
    };

    const selectedOfficerObj = useMemo(() => {
        return officerOptions.find((o) => `${o.type}:${o.name}` === selectedOfficerKey) || null;
    }, [officerOptions, selectedOfficerKey]);

    const assetGroups = useMemo(() => {
        const map = new Map<string, AssetGroup>();
        availableAssets.forEach((asset) => {
            const groupKey = `${asset.ParNumber}_${asset.SourceDRDetailID || asset.InventoryID || asset.ArticleName}_${asset.Description}`;
            if (!map.has(groupKey)) {
                map.set(groupKey, {
                    groupKey,
                    parNumber: asset.ParNumber,
                    description: asset.Description,
                    acquisitionCost: asset.AcquisitionCost,
                    items: [],
                });
            }
            map.get(groupKey)!.items.push(asset);
        });
        return Array.from(map.values());
    }, [availableAssets]);

    const totalPages = Math.ceil(assetGroups.length / ITEMS_PER_PAGE) || 1;
    const paginatedGroups = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return assetGroups.slice(start, start + ITEMS_PER_PAGE);
    }, [assetGroups, currentPage]);

    const toggleDescExpand = (key: string) => {
        setExpandedDescKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const toggleAssetSelect = (invDetailId: number) => {
        setSelectedAssetIds((prev) => {
            const next = new Set(prev);
            if (next.has(invDetailId)) {
                next.delete(invDetailId);
            } else {
                next.add(invDetailId);
            }
            return next;
        });
    };

    const toggleGroupSelect = (group: AssetGroup) => {
        const allGroupSelected = group.items.every((item) => selectedAssetIds.has(item.InventoryDetailID));
        setSelectedAssetIds((prev) => {
            const next = new Set(prev);
            group.items.forEach((item) => {
                if (allGroupSelected) {
                    next.delete(item.InventoryDetailID);
                } else {
                    next.add(item.InventoryDetailID);
                }
            });
            return next;
        });
    };

    const toggleGroupExpand = (groupKey: string) => {
        setExpandedGroupKeys((prev) => {
            const next = new Set(prev);
            if (next.has(groupKey)) {
                next.delete(groupKey);
            } else {
                next.add(groupKey);
            }
            return next;
        });
    };

    const selectedAssetsList = useMemo(() => {
        return availableAssets.filter((a) => selectedAssetIds.has(a.InventoryDetailID));
    }, [availableAssets, selectedAssetIds]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedOfficerObj || !selectedOfficerObj.name.trim()) {
            toast.error('Accountable Officer is required');
            return;
        }

        if (selectedAssetIds.size === 0) {
            toast.error('Please select at least one asset');
            return;
        }

        if (policeNotified) {
            if (!policeStation.trim()) {
                toast.error('Police Station is required when Police Notified is Yes');
                return;
            }
            if (!dateReported) {
                toast.error('Date Reported is required when Police Notified is Yes');
                return;
            }
            const todayStr = new Date().toISOString().split('T')[0];
            if (dateReported > todayStr) {
                toast.error('Date Reported to Police cannot be in the future');
                return;
            }
        }

        try {
            setSubmitting(true);

            const payload = {
                DepartmentID: Number(selectedDeptId),
                AccountableOfficer: selectedOfficerObj.name.trim(),
                Status: status,
                PoliceNotified: policeNotified,
                PoliceStation: policeNotified ? policeStation.trim() : null,
                DateReported: policeNotified ? dateReported : null,
                Remarks: remarks.trim() || null,
                items: selectedAssetsList.map((asset) => ({
                    InventoryDetailID: asset.InventoryDetailID,
                    PropertyNumber: asset.PropertyNumber,
                    AcquisitionCost: asset.AcquisitionCost,
                    Description: asset.Description,
                })),
            };

            await rlsddpAPI.updateReport(id, payload);
            toast.success('RLSDDP report updated successfully!');
            router.push(baseRoute);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Failed to update RLSDDP report');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="p-12 text-center text-slate-500">Loading RLSDDP report...</div>;
    }

    if (!report) {
        return <div className="p-12 text-center text-slate-500">RLSDDP report not found.</div>;
    }

    return (
        <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}>
            <div className="p-4 sm:p-6 lg:p-8 space-y-6 w-full">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <Link
                        href={baseRoute}
                        className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/80 bg-white/50 border border-slate-200 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Edit RLSDDP Report ({report.RlsddpNumber})</h1>
                        <p className="text-slate-500 text-sm">
                            Update details and asset selection for RLSDDP report {report.RlsddpNumber}
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Department & Officer */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                        <h2 className="text-base font-bold text-slate-900 border-b pb-3 border-slate-200 flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-[var(--primary)]" />
                            1. Department & Accountable Officer
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Searchable Department Combobox */}
                            <div className="relative" ref={deptComboboxRef}>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Department <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Search and select department..."
                                        value={deptSearchQuery}
                                        onChange={(e) => {
                                            setDeptSearchQuery(e.target.value);
                                            setDeptComboboxOpen(true);
                                        }}
                                        onFocus={() => setDeptComboboxOpen(true)}
                                        className="w-full pl-3 pr-10 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                    />
                                    <ChevronDown className="w-4 h-4 absolute right-3 top-3 text-slate-400 pointer-events-none" />
                                </div>

                                {deptComboboxOpen && (
                                    <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                        {filteredDepartments.length === 0 ? (
                                            <div className="p-3 text-sm text-slate-500 text-center">No department found</div>
                                        ) : (
                                            filteredDepartments.map((dept) => (
                                                <button
                                                    type="button"
                                                    key={dept.DepartmentID}
                                                    onClick={() => handleDepartmentChange(dept)}
                                                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex items-center justify-between ${
                                                        selectedDeptId === dept.DepartmentID ? 'bg-slate-50 font-medium text-[var(--primary)]' : 'text-slate-800'
                                                    }`}
                                                >
                                                    <span>
                                                        {dept.DepartmentName} {dept.DepartmentCode ? `(${dept.DepartmentCode})` : ''}
                                                    </span>
                                                    {selectedDeptId === dept.DepartmentID && <Check className="w-4 h-4 text-[var(--primary)]" />}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Accountable Officer Selection Dropdown */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Accountable Officer <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={selectedOfficerKey}
                                    onChange={(e) => handleOfficerSelectChange(e.target.value)}
                                    disabled={!selectedDeptId || officerOptions.length === 0}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                >
                                    {officerOptions.map((opt) => (
                                        <option key={`${opt.type}:${opt.name}`} value={`${opt.type}:${opt.name}`}>
                                            {opt.label || opt.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Status & Police Details */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                        <h2 className="text-base font-bold text-slate-900 border-b pb-3 border-slate-200 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-[var(--primary)]" />
                            2. Status & Police Information
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Status <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value as RlsddpStatus)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                >
                                    <option value="Lost">Lost</option>
                                    <option value="Stolen">Stolen</option>
                                    <option value="Damaged">Damaged</option>
                                    <option value="Destroyed">Destroyed</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Police Notified?
                                </label>
                                <div className="flex items-center gap-6">
                                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
                                        <input
                                            type="radio"
                                            name="policeNotified"
                                            checked={!policeNotified}
                                            onChange={() => setPoliceNotified(false)}
                                            className="w-4 h-4 text-[var(--primary)]"
                                        />
                                        No
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
                                        <input
                                            type="radio"
                                            name="policeNotified"
                                            checked={policeNotified}
                                            onChange={() => setPoliceNotified(true)}
                                            className="w-4 h-4 text-[var(--primary)]"
                                        />
                                        Yes
                                    </label>
                                </div>
                            </div>
                        </div>

                        {policeNotified && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Police Station
                                    </label>
                                    <input
                                        type="text"
                                        value={policeStation}
                                        onChange={(e) => setPoliceStation(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Date Reported
                                    </label>
                                    <input
                                        type="date"
                                        value={dateReported}
                                        max={new Date().toISOString().split('T')[0]}
                                        onChange={(e) => setDateReported(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Remarks
                            </label>
                            <textarea
                                rows={3}
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            />
                        </div>
                    </div>

                    {/* Section 3: Select Assets (Paginated 25 items per page) */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                        <h2 className="text-base font-bold text-slate-900 border-b pb-3 border-slate-200 flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5 text-[var(--primary)]" />
                            3. Select Assets Assigned to Department ({selectedAssetIds.size} selected)
                        </h2>

                        <div className="overflow-x-auto rounded-lg border border-slate-200">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 text-xs uppercase">
                                        <th className="px-3 py-3 w-10 text-center">Select</th>
                                        <th className="px-4 py-3 w-40">PAR Number</th>
                                        <th className="px-4 py-3 w-48">Property No.</th>
                                        <th className="px-4 py-3 w-32 text-right">Cost</th>
                                        <th className="px-4 py-3">Description</th>
                                        <th className="px-4 py-3 w-24 text-center">Qty</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {paginatedGroups.map((group) => {
                                        const selectedInGroup = group.items.filter((item) => selectedAssetIds.has(item.InventoryDetailID));
                                        const isAllSelected = selectedInGroup.length === group.items.length;
                                        const isSomeSelected = selectedInGroup.length > 0 && !isAllSelected;
                                        const isExpanded = expandedGroupKeys.has(group.groupKey);
                                        const isDescExpanded = expandedDescKeys.has(group.groupKey);

                                        const propertyNoSummary = group.items.length === 1
                                            ? group.items[0].PropertyNumber
                                            : `${group.items[0].PropertyNumber} (+${group.items.length - 1} more)`;

                                        return (
                                            <Fragment key={group.groupKey}>
                                                <tr className={`transition-colors ${isAllSelected ? 'bg-rose-50/70' : isSomeSelected ? 'bg-amber-50/50' : 'hover:bg-slate-50'}`}>
                                                    <td className="px-3 py-3 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={isAllSelected}
                                                            ref={(el) => {
                                                                if (el) el.indeterminate = isSomeSelected;
                                                            }}
                                                            onChange={() => toggleGroupSelect(group)}
                                                            className="w-4 h-4 text-[var(--primary)] rounded border-slate-300 cursor-pointer"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">{group.parNumber}</td>
                                                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{propertyNoSummary}</td>
                                                    <td className="px-4 py-3 text-right font-medium text-slate-900 whitespace-nowrap">₱{group.acquisitionCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                                    <td className="px-4 py-3 text-slate-700 max-w-md">
                                                        <div
                                                            onClick={() => toggleDescExpand(group.groupKey)}
                                                            className="cursor-pointer group/desc"
                                                            title="Click to view full description"
                                                        >
                                                            <p className={isDescExpanded ? 'text-slate-900 whitespace-normal' : 'truncate text-slate-700'}>
                                                                {group.description}
                                                            </p>
                                                            <span className="text-[10px] text-slate-400 group-hover/desc:text-[var(--primary)] transition-colors">
                                                                {isDescExpanded ? 'Show less' : 'Click for full text'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleGroupExpand(group.groupKey)}
                                                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                                                                isExpanded
                                                                    ? 'bg-[var(--primary)] text-white'
                                                                    : selectedInGroup.length > 0
                                                                    ? 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                                                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                            }`}
                                                        >
                                                            {group.items.length}
                                                            {selectedInGroup.length > 0 && selectedInGroup.length < group.items.length && (
                                                                <span className="text-[10px] opacity-75">({selectedInGroup.length})</span>
                                                            )}
                                                            {isExpanded ? <ChevronDown className="w-3 h-3 ml-0.5" /> : <ChevronRight className="w-3 h-3 ml-0.5" />}
                                                        </button>
                                                    </td>
                                                </tr>

                                                {isExpanded && (
                                                    <tr className="bg-slate-50/90 border-b border-slate-200">
                                                        <td colSpan={6} className="p-4 pl-12">
                                                            <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 shadow-xs">
                                                                <div className="flex items-center justify-between text-xs font-bold text-slate-600 border-b pb-2">
                                                                    <span>Select Specific Property Numbers in this Batch ({selectedInGroup.length} of {group.items.length} selected):</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleGroupSelect(group)}
                                                                        className="text-[var(--primary)] hover:underline text-xs font-semibold"
                                                                    >
                                                                        {isAllSelected ? 'Deselect All in Batch' : 'Select All in Batch'}
                                                                    </button>
                                                                </div>
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                                                                    {group.items.map((item) => {
                                                                        const isSelected = selectedAssetIds.has(item.InventoryDetailID);
                                                                        return (
                                                                            <label
                                                                                key={item.InventoryDetailID}
                                                                                className={`flex items-center justify-between p-2 rounded-md border text-xs cursor-pointer transition-colors ${
                                                                                    isSelected
                                                                                        ? 'bg-rose-50 border-rose-300 text-rose-900 font-semibold'
                                                                                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                                                                                }`}
                                                                            >
                                                                                <div className="flex items-center gap-2">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={isSelected}
                                                                                        onChange={() => toggleAssetSelect(item.InventoryDetailID)}
                                                                                        className="w-3.5 h-3.5 text-[var(--primary)] rounded border-slate-300 cursor-pointer"
                                                                                    />
                                                                                    <span>{item.PropertyNumber}</span>
                                                                                </div>
                                                                                <span className="text-slate-500 font-normal">
                                                                                    ₱{item.AcquisitionCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                                                </span>
                                                                            </label>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Controls for Section 3 */}
                        {totalPages > 1 && (
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-600">
                                <div>
                                    Showing <span className="font-semibold text-slate-900">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
                                    <span className="font-semibold text-slate-900">{Math.min(currentPage * ITEMS_PER_PAGE, assetGroups.length)}</span> of{' '}
                                    <span className="font-semibold text-slate-900">{assetGroups.length}</span> asset groups
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                        className="px-2.5 py-1 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors flex items-center gap-1"
                                    >
                                        <ChevronLeft className="w-3.5 h-3.5" /> Previous
                                    </button>
                                    <span className="px-3 py-1 font-medium text-slate-700">
                                        Page {currentPage} of {totalPages}
                                    </span>
                                    <button
                                        type="button"
                                        disabled={currentPage === totalPages}
                                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                        className="px-2.5 py-1 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors flex items-center gap-1"
                                    >
                                        Next <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Section 4: Selected Assets (Individual Uncombined Rows) */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                        <h2 className="text-base font-bold text-slate-900 border-b pb-3 border-slate-200 flex items-center gap-2">
                            <PackageCheck className="w-5 h-5 text-[var(--primary)]" />
                            4. Selected Assets ({selectedAssetsList.length} items)
                        </h2>

                        {selectedAssetsList.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                                No assets selected yet. Check items in Section 3 above to add them to this list.
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border border-slate-200">
                                <table className="w-full text-left border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 text-xs uppercase">
                                            <th className="px-4 py-3 w-12 text-center">#</th>
                                            <th className="px-4 py-3 w-40 font-semibold text-slate-700">PAR Number</th>
                                            <th className="px-4 py-3 w-48 font-semibold text-slate-700">Property No.</th>
                                            <th className="px-4 py-3 w-32 text-right font-semibold text-slate-700">Cost</th>
                                            <th className="px-4 py-3 font-semibold text-slate-700">Description</th>
                                            <th className="px-4 py-3 w-16 text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {selectedAssetsList.map((asset, idx) => {
                                            const isDescExpanded = expandedDescKeys.has(`selected_${asset.InventoryDetailID}`);
                                            return (
                                                <tr key={asset.InventoryDetailID} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-4 py-3 text-center text-slate-500 text-xs">{idx + 1}</td>
                                                    <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">{asset.ParNumber}</td>
                                                    <td className="px-4 py-3 text-slate-800 font-medium whitespace-nowrap">{asset.PropertyNumber}</td>
                                                    <td className="px-4 py-3 text-right font-medium text-slate-900 whitespace-nowrap">
                                                        ₱{asset.AcquisitionCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-700 max-w-md">
                                                        <div
                                                            onClick={() => toggleDescExpand(`selected_${asset.InventoryDetailID}`)}
                                                            className="cursor-pointer group/desc"
                                                            title="Click to view full description"
                                                        >
                                                            <p className={isDescExpanded ? 'text-slate-900 whitespace-normal' : 'truncate text-slate-700'}>
                                                                {asset.Description}
                                                            </p>
                                                            <span className="text-[10px] text-slate-400 group-hover/desc:text-[var(--primary)] transition-colors">
                                                                {isDescExpanded ? 'Show less' : 'Click for full text'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleAssetSelect(asset.InventoryDetailID)}
                                                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                                                            title="Remove asset"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                        <Link
                            href={baseRoute}
                            className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-5 py-2 bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shadow-xs"
                        >
                            {submitting ? 'Updating...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

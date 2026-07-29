'use client';

import { useEffect, useState, useCallback, useMemo, useRef, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Building2, User, FileText, Search, AlertCircle, ShieldAlert, ChevronDown, ChevronRight, Check, ChevronLeft, Trash2, PackageCheck } from 'lucide-react';
import { toast } from 'sonner';
import { rlsddpAPI } from '@/lib/api/rlsddp';
import { DepartmentAsset, RlsddpStatus, AccountableOfficerOption } from '@/types/propertyRlsddp';
import { TransferDepartment } from '@/types/propertyTransfer';

interface RlsddpCreatePageProps {
    baseRoute: string;
}

interface AssetGroup {
    groupKey: string;
    parNumber: string;
    description: string;
    acquisitionCost: number;
    items: DepartmentAsset[];
}

export function RlsddpCreatePage({ baseRoute }: RlsddpCreatePageProps) {
    const router = useRouter();

    // 1. Department Selection State
    const [departments, setDepartments] = useState<TransferDepartment[]>([]);
    const [selectedDeptId, setSelectedDeptId] = useState<number | ''>('');
    const [deptSearchQuery, setDeptSearchQuery] = useState('');
    const [deptComboboxOpen, setDeptComboboxOpen] = useState(false);
    const deptComboboxRef = useRef<HTMLDivElement | null>(null);

    // 2. Accountable Officer Selection State
    const [officerOptions, setOfficerOptions] = useState<AccountableOfficerOption[]>([]);
    const [selectedOfficerKey, setSelectedOfficerKey] = useState<string>('');

    // 3. PAR / ICS Selection State
    const [selectedParNumber, setSelectedParNumber] = useState<string>('');

    // All assets loaded for current department & officer
    const [allFetchedAssets, setAllFetchedAssets] = useState<DepartmentAsset[]>([]);

    // Incident details
    const [status, setStatus] = useState<RlsddpStatus>('Lost');
    const [policeNotified, setPoliceNotified] = useState(false);
    const [policeStation, setPoliceStation] = useState('');
    const [dateReported, setDateReported] = useState('');
    const [remarks, setRemarks] = useState('');

    // Asset selection
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<number>>(new Set());
    const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(new Set());
    const [expandedDescKeys, setExpandedDescKeys] = useState<Set<string>>(new Set());

    // Pagination for Section 3 (25 per page)
    const [currentPage, setCurrentPage] = useState<number>(1);
    const ITEMS_PER_PAGE = 25;

    const [assetSearch, setAssetSearch] = useState('');
    const [loadingDepts, setLoadingDepts] = useState(true);
    const [loadingAssets, setLoadingAssets] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Fetch Departments on load
    useEffect(() => {
        const loadDepts = async () => {
            try {
                setLoadingDepts(true);
                const data = await rlsddpAPI.getDepartments();
                setDepartments(data || []);
            } catch {
                toast.error('Failed to load departments');
            } finally {
                setLoadingDepts(false);
            }
        };
        loadDepts();
    }, []);

    // Outside click listener for department combobox
    useEffect(() => {
        const onClickOutside = (e: MouseEvent) => {
            if (deptComboboxRef.current && !deptComboboxRef.current.contains(e.target as Node)) {
                setDeptComboboxOpen(false);
            }
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    // Filtered departments for combobox
    const filteredDepartments = useMemo(() => {
        if (!deptSearchQuery.trim()) return departments;
        const q = deptSearchQuery.toLowerCase();
        return departments.filter(
            (d) =>
                d.DepartmentName.toLowerCase().includes(q) ||
                (d.DepartmentCode && d.DepartmentCode.toLowerCase().includes(q))
        );
    }, [departments, deptSearchQuery]);

    // Fetch assets for chosen officer
    const fetchAssetsForOfficer = useCallback(async (deptId: number, officer: AccountableOfficerOption) => {
        try {
            setLoadingAssets(true);
            const assetsData = await rlsddpAPI.getDepartmentAssets(deptId, {
                officer: officer.name,
                officer_type: officer.type,
            });
            setAllFetchedAssets(assetsData || []);
            setSelectedParNumber('');
            setSelectedAssetIds(new Set());
            setCurrentPage(1);
        } catch {
            toast.error('Failed to load assets for selected accountable officer');
        } finally {
            setLoadingAssets(false);
        }
    }, []);

    // Handle Department Change (Flow Step 1)
    const handleDepartmentChange = useCallback(async (dept: TransferDepartment) => {
        setSelectedDeptId(dept.DepartmentID);
        setDeptSearchQuery(dept.DepartmentName);
        setDeptComboboxOpen(false);
        setSelectedOfficerKey('');
        setSelectedParNumber('');
        setAllFetchedAssets([]);
        setSelectedAssetIds(new Set());
        setExpandedGroupKeys(new Set());
        setExpandedDescKeys(new Set());
        setCurrentPage(1);

        try {
            setLoadingAssets(true);
            const officerRes = await rlsddpAPI.getAccountableOfficers(dept.DepartmentID);
            const list = officerRes?.accountable_officers || [];
            setOfficerOptions(list);

            if (list.length > 0) {
                const defaultOff = list[0];
                const key = `${defaultOff.type}:${defaultOff.name}`;
                setSelectedOfficerKey(key);
                await fetchAssetsForOfficer(dept.DepartmentID, defaultOff);
            } else {
                setSelectedOfficerKey('');
                setAllFetchedAssets([]);
                setLoadingAssets(false);
            }
        } catch {
            toast.error('Failed to load department officers');
            setLoadingAssets(false);
        }
    }, [fetchAssetsForOfficer]);

    // Handle Officer Selection Change (Flow Step 2)
    const handleOfficerSelectChange = async (key: string) => {
        setSelectedOfficerKey(key);
        const found = officerOptions.find((o) => `${o.type}:${o.name}` === key);
        if (found && selectedDeptId) {
            setSelectedParNumber('');
            setSelectedAssetIds(new Set());
            setExpandedGroupKeys(new Set());
            setExpandedDescKeys(new Set());
            setCurrentPage(1);
            await fetchAssetsForOfficer(Number(selectedDeptId), found);
        }
    };

    // Current selected officer object
    const selectedOfficerObj = useMemo(() => {
        return officerOptions.find((o) => `${o.type}:${o.name}` === selectedOfficerKey) || null;
    }, [officerOptions, selectedOfficerKey]);

    // Distinct PAR / ICS Document Numbers for current Department & Officer (Flow Step 3)
    const availableParNumbers = useMemo(() => {
        const set = new Set<string>();
        allFetchedAssets.forEach((a) => {
            if (a.ParNumber && a.ParNumber.trim() && a.ParNumber !== 'N/A' && a.ParNumber !== 'PAR N/A' && a.ParNumber !== 'ICS N/A') {
                set.add(a.ParNumber.trim());
            }
        });
        return Array.from(set).sort();
    }, [allFetchedAssets]);

    // Handle PAR / ICS Selection Change (Flow Step 3)
    const handleParNumberSelect = (parNo: string) => {
        setSelectedParNumber(parNo);
        setCurrentPage(1);
        setSelectedAssetIds(new Set()); // Do not auto-select, let user select manually
    };

    // Assets displayed in Section 3 (Filtered by selected PAR/ICS No.)
    const displayedAssets = useMemo(() => {
        if (!selectedParNumber) return allFetchedAssets;
        return allFetchedAssets.filter((a) => a.ParNumber.trim() === selectedParNumber.trim());
    }, [allFetchedAssets, selectedParNumber]);

    // Asset Groups for Section 3
    const assetGroups = useMemo(() => {
        let assetsToGroup = displayedAssets;
        if (assetSearch.trim()) {
            const q = assetSearch.toLowerCase();
            assetsToGroup = displayedAssets.filter(
                (a) =>
                    a.PropertyNumber.toLowerCase().includes(q) ||
                    a.ParNumber.toLowerCase().includes(q) ||
                    a.Description.toLowerCase().includes(q) ||
                    a.ArticleName.toLowerCase().includes(q)
            );
        }

        const map = new Map<string, AssetGroup>();
        assetsToGroup.forEach((asset) => {
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
    }, [displayedAssets, assetSearch]);

    // Paginated Asset Groups
    const totalPages = Math.ceil(assetGroups.length / ITEMS_PER_PAGE) || 1;
    const paginatedGroups = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return assetGroups.slice(start, start + ITEMS_PER_PAGE);
    }, [assetGroups, currentPage]);

    // Expand description
    const toggleDescExpand = (key: string) => {
        setExpandedDescKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    // Toggle individual asset
    const toggleAssetSelect = (invDetailId: number) => {
        setSelectedAssetIds((prev) => {
            const next = new Set(prev);
            if (next.has(invDetailId)) next.delete(invDetailId);
            else next.add(invDetailId);
            return next;
        });
    };

    // Toggle entire group
    const toggleGroupSelect = (group: AssetGroup) => {
        const allGroupSelected = group.items.every((item) => selectedAssetIds.has(item.InventoryDetailID));
        setSelectedAssetIds((prev) => {
            const next = new Set(prev);
            group.items.forEach((item) => {
                if (allGroupSelected) next.delete(item.InventoryDetailID);
                else next.add(item.InventoryDetailID);
            });
            return next;
        });
    };

    // Expand/collapse sub-table
    const toggleGroupExpand = (groupKey: string) => {
        setExpandedGroupKeys((prev) => {
            const next = new Set(prev);
            if (next.has(groupKey)) next.delete(groupKey);
            else next.add(groupKey);
            return next;
        });
    };

    // Select All assets
    const toggleSelectAll = () => {
        if (selectedAssetIds.size === displayedAssets.length && displayedAssets.length > 0) {
            setSelectedAssetIds(new Set());
        } else {
            const next = new Set<number>();
            displayedAssets.forEach((a) => next.add(a.InventoryDetailID));
            setSelectedAssetIds(next);
        }
    };

    // Selected assets list for Section 4
    const selectedAssetsList = useMemo(() => {
        return allFetchedAssets.filter((a) => selectedAssetIds.has(a.InventoryDetailID));
    }, [allFetchedAssets, selectedAssetIds]);

    // Handle submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedDeptId) {
            toast.error('Please select a department');
            return;
        }

        if (!selectedOfficerObj || !selectedOfficerObj.name.trim()) {
            toast.error('Accountable Officer is required');
            return;
        }

        if (selectedAssetIds.size === 0) {
            toast.error('Please select at least one asset to include in the report');
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

            await rlsddpAPI.createReport(payload);
            toast.success(
                status === 'Destroyed'
                    ? 'RLSDDP created! Selected asset(s) automatically set to Unserviceable in inventory.'
                    : 'RLSDDP report created successfully!'
            );
            router.push(baseRoute);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Failed to create RLSDDP report');
        } finally {
            setSubmitting(false);
        }
    };

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
                        <h1 className="text-2xl font-bold text-slate-900">New RLSDDP Report</h1>
                        <p className="text-slate-500 text-sm">
                            Create a Report of Lost, Stolen, Damaged or Destroyed Property
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Section 1: Department -> Accountable Officer -> PAR / ICS Selection */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                        <h2 className="text-base font-bold text-slate-900 border-b pb-3 border-slate-200 flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-[var(--primary)]" />
                            1. Select Department, Accountable Officer & PAR / ICS Number
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Step 1: Department Selection */}
                            <div className="relative" ref={deptComboboxRef}>
                                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                                    <Building2 className="w-4 h-4 text-slate-400" />
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
                                        disabled={loadingDepts}
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

                            {/* Step 2: Accountable Officer Selection */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                                    <User className="w-4 h-4 text-slate-400" />
                                    Accountable Officer <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={selectedOfficerKey}
                                    onChange={(e) => handleOfficerSelectChange(e.target.value)}
                                    disabled={!selectedDeptId || officerOptions.length === 0}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                >
                                    {!selectedDeptId ? (
                                        <option value="">Select department first</option>
                                    ) : officerOptions.length === 0 ? (
                                        <option value="">No accountable officers found</option>
                                    ) : (
                                        officerOptions.map((opt) => (
                                            <option key={`${opt.type}:${opt.name}`} value={`${opt.type}:${opt.name}`}>
                                                {opt.label || opt.name}
                                            </option>
                                        ))
                                    )}
                                </select>
                            </div>

                            {/* Step 3: PAR No. / ICS No. Selection */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                                    <FileText className="w-4 h-4 text-slate-400" />
                                    PAR No. / ICS No.
                                </label>
                                <select
                                    value={selectedParNumber}
                                    onChange={(e) => handleParNumberSelect(e.target.value)}
                                    disabled={!selectedOfficerKey || loadingAssets}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                >
                                    {!selectedOfficerKey ? (
                                        <option value="">Select accountable officer first</option>
                                    ) : availableParNumbers.length === 0 ? (
                                        <option value="">No PAR/ICS documents found</option>
                                    ) : (
                                        <>
                                            <option value="">All PAR / ICS Documents ({availableParNumbers.length})</option>
                                            {availableParNumbers.map((parNo) => (
                                                <option key={parNo} value={parNo}>
                                                    {parNo}
                                                </option>
                                            ))}
                                        </>
                                    )}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Incident Status & Police Notification Details */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                        <h2 className="text-base font-bold text-slate-900 border-b pb-3 border-slate-200 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-[var(--primary)]" />
                            2. Incident Status & Police Notification Details
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Status Dropdown */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Incident Status <span className="text-rose-500">*</span>
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
                                {status === 'Destroyed' && (
                                    <p className="text-xs font-semibold text-rose-600 mt-1">
                                        Notice: Selecting "Destroyed" will automatically update selected asset(s) to Unserviceable in inventory.
                                    </p>
                                )}
                            </div>

                            {/* Police Notified Toggle */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Police Notified? <span className="text-rose-500">*</span>
                                </label>
                                <div className="flex items-center gap-6">
                                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
                                        <input
                                            type="radio"
                                            name="policeNotified"
                                            checked={!policeNotified}
                                            onChange={() => {
                                                setPoliceNotified(false);
                                                setPoliceStation('');
                                                setDateReported('');
                                            }}
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

                        {/* Police Details */}
                        {policeNotified && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Police Station <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={policeStation}
                                        onChange={(e) => setPoliceStation(e.target.value)}
                                        placeholder="Name/location of Police Station"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Date Reported to Police <span className="text-rose-500">*</span>
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
                                Circumstances / Remarks
                            </label>
                            <textarea
                                rows={3}
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                placeholder="Provide details regarding the loss, theft, damage, or destruction..."
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            />
                        </div>
                    </div>

                    {/* Section 3: Select Assets Assigned to Department & Officer */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-3 border-slate-200">
                            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                <ShieldAlert className="w-5 h-5 text-[var(--primary)]" />
                                3. Select Assets Assigned to Officer ({selectedAssetIds.size} selected)
                            </h2>
                            {selectedDeptId && displayedAssets.length > 0 && (
                                <div className="relative w-full sm:w-64">
                                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Filter by property #, desc..."
                                        value={assetSearch}
                                        onChange={(e) => {
                                            setAssetSearch(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                                    />
                                </div>
                            )}
                        </div>

                        {!selectedDeptId ? (
                            <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                                Please select a department above to view assigned assets.
                            </div>
                        ) : loadingAssets ? (
                            <div className="p-8 text-center text-slate-500">
                                Loading assets assigned to selected officer...
                            </div>
                        ) : displayedAssets.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-lg">
                                {selectedParNumber
                                    ? `No assets found under ${selectedParNumber}.`
                                    : 'No assets currently assigned to this officer.'}
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto rounded-lg border border-slate-200">
                                    <table className="w-full text-left border-collapse text-sm">
                                        <thead>
                                            <tr className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 text-xs uppercase">
                                                <th className="px-3 py-3 w-10 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedAssetIds.size === displayedAssets.length && displayedAssets.length > 0}
                                                        onChange={toggleSelectAll}
                                                        className="w-4 h-4 text-[var(--primary)] rounded border-slate-300 cursor-pointer"
                                                        title="Select All"
                                                    />
                                                </th>
                                                <th className="px-4 py-3 w-40">PAR/ICS Number</th>
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
                                                        {/* Combined Group Row */}
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
                                                            <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                                                                {group.parNumber}
                                                            </td>
                                                            <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                                                                {propertyNoSummary}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-medium text-slate-900 whitespace-nowrap">
                                                                ₱{group.acquisitionCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                            </td>
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
                                                                    title="Click to select individual property numbers"
                                                                >
                                                                    {group.items.length}
                                                                    {selectedInGroup.length > 0 && selectedInGroup.length < group.items.length && (
                                                                        <span className="text-[10px] opacity-75">({selectedInGroup.length})</span>
                                                                    )}
                                                                    {isExpanded ? <ChevronDown className="w-3 h-3 ml-0.5" /> : <ChevronRight className="w-3 h-3 ml-0.5" />}
                                                                </button>
                                                            </td>
                                                        </tr>

                                                        {/* Sub-table */}
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

                                {/* Pagination Controls */}
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
                            </>
                        )}
                    </div>

                    {/* Section 4: Selected Assets */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                        <h2 className="text-base font-bold text-slate-900 border-b pb-3 border-slate-200 flex items-center gap-2">
                            <PackageCheck className="w-5 h-5 text-[var(--primary)]" />
                            4. Selected Assets ({selectedAssetsList.length} items)
                        </h2>

                        {selectedAssetsList.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                                No assets selected yet. Select department, accountable officer, and check items above.
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border border-slate-200">
                                <table className="w-full text-left border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 text-xs uppercase">
                                            <th className="px-4 py-3 w-12 text-center">#</th>
                                            <th className="px-4 py-3 w-40 font-semibold text-slate-700">PAR/ICS Number</th>
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

                    {/* Controls */}
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
                            {submitting ? 'Creating RLSDDP...' : 'Create RLSDDP Report'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

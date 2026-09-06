'use client';

import { useRef, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { QRCodeWithPrint } from '@/components/ui/QRCodeWithPrint';
import { lookupQrAsset } from '@/lib/api/qr';
import type { QrLookupResponse, QrScanAssignedProperty, QrUnassignedInventoryDetail } from '@/types/qr';
import {
    AlertCircle,
    Building2,
    Calendar,
    Check,
    Copy,
    FileCheck,
    FileText,
    History,
    Loader2,
    Package,
    RotateCcw,
    Search,
    Shield,
    Tag,
    User,
    X,
} from 'lucide-react';

interface RecentSearchItem {
    id: string;
    propertyNumber: string;
    description: string;
    timestamp: string;
    type: 'assigned' | 'inventory_unassigned';
}

export function QrScanPage() {
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Current displayed asset
    const [assetResult, setAssetResult] = useState<QrLookupResponse | null>(null);
    const [lastQuery, setLastQuery] = useState('');
    const [copied, setCopied] = useState(false);

    // Session history
    const [history, setHistory] = useState<RecentSearchItem[]>([]);

    const inputRef = useRef<HTMLInputElement | null>(null);

    // Auto focus on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Perform lookup
    const performLookup = async (queryValue: string) => {
        const query = queryValue.trim();
        if (!query) {
            toast.error('Please verify the property number.');
            return;
        }

        setLoading(true);
        setError(null);
        setLastQuery(query);

        try {
            const data = await lookupQrAsset(query);
            if (data.found) {
                setAssetResult(data);
                toast.success('Property asset details loaded!');

                // Extract property number & description for recent searches
                const pNum =
                    data.property?.inventoryDetail?.PropertyNumber ??
                    data.property?.PropertyCardNumber ??
                    data.inventory_detail?.PropertyNumber ??
                    query;
                const desc =
                    data.property?.inventoryDetail?.drDetail?.ItemDescription ??
                    data.property?.Description ??
                    data.inventory_detail?.Description ??
                    'Property Item';

                setHistory((prev) => {
                    const filtered = prev.filter((item) => item.propertyNumber !== pNum);
                    return [
                        {
                            id: `${Date.now()}-${pNum}`,
                            propertyNumber: pNum,
                            description: desc,
                            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            type: data.type || 'assigned',
                        },
                        ...filtered.slice(0, 7), // keep up to 8 recent searches
                    ];
                });
            } else {
                setAssetResult(null);
                const msg = 'Property number not found. Please verify.';
                setError(msg);
                toast.error(msg);
            }
        } catch {
            setAssetResult(null);
            const msg = 'Property number not found. Please verify.';
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        void performLookup(input);
    };

    const handleReset = () => {
        setAssetResult(null);
        setInput('');
        setError(null);
        setLastQuery('');
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    const handleQuickSelect = (propertyNumber: string) => {
        setInput(propertyNumber);
        void performLookup(propertyNumber);
    };

    // Formatters
    const formatCurrency = (amount?: number | string | null) => {
        if (amount === null || amount === undefined || amount === '') return '-';
        const num = Number(amount);
        if (Number.isNaN(num)) return String(amount);
        return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatDate = (dateStr?: string | null) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        if (Number.isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const handleCopyDetails = () => {
        if (!assetResult) return;
        const prop = assetResult.property;
        const inv = assetResult.inventory_detail;

        const pNum = prop?.inventoryDetail?.PropertyNumber || inv?.PropertyNumber || '-';
        const desc = prop?.inventoryDetail?.drDetail?.ItemDescription || prop?.Description || inv?.Description || '-';
        const officer = prop?.endUser?.FullName || 'Unassigned';
        const dept = prop?.department?.DepartmentName || prop?.endUser?.department?.DepartmentName || 'GSO Custodian';
        const cond = prop?.condition?.ConditionName || inv?.ConditionName || 'Serviceable';
        const val = formatCurrency(prop?.inventoryDetail?.UnitCost ?? inv?.UnitCost);

        const text = `Property #: ${pNum}\nItem: ${desc}\nCost: ${val}\nCondition: ${cond}\nAccountable Officer: ${officer}\nDepartment: ${dept}`;

        void navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            toast.success('Property details copied to clipboard');
            setTimeout(() => setCopied(false), 2000);
        });
    };

    // Render assigned property details
    const renderAssignedProperty = (property: QrScanAssignedProperty, latestIssuance: QrLookupResponse['latest_issuance_detail']) => {
        const detail = property.inventoryDetail;
        const itemName = detail?.drDetail?.ItemDescription || property.Description || 'Item Not Recorded';
        const article = detail?.drDetail?.article?.ArticleName || 'General Property';
        const propertyNo = detail?.PropertyNumber || property.PropertyCardNumber || 'Unassigned';
        const propertyCardNo = property.PropertyCardNumber || '-';
        const unitCost = formatCurrency(detail?.UnitCost);
        const classification = detail?.ClassificationName || 'Property, Plant & Equipment';
        const propertyType = detail?.PropertyName || '-';
        const brandModelSerial = [detail?.Brand, detail?.ModelNumber, detail?.SerialNumber ? `S/N: ${detail.SerialNumber}` : null]
            .filter(Boolean)
            .join(' • ') || 'None specified';

        const endUser = property.endUser?.FullName || 'No Assigned Custodian';
        const department = property.department?.DepartmentName || property.endUser?.department?.DepartmentName || 'GSO Office';
        const deptHead = property.currentDepartmentHead || property.accountabilityLabel || '-';

        const condition = property.condition?.ConditionName || 'Serviceable';
        const isUnserviceable = condition.toLowerCase().includes('unserviceable');
        const status = property.propertyStatus?.StatusName || 'Issued';

        const issuance = latestIssuance?.issuance;
        const documentType = issuance?.DocumentType || property.documentType || 'PAR';
        const documentNo = issuance?.DocumentNumber || '-';
        const dateIssued = formatDate(issuance?.DateIssued || property.AssignedDate);
        const issuedBy = issuance?.issuedBy?.FullName || issuance?.issued_by?.FullName || 'GSO Property Officer';

        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const qrUrl = `${origin}/qr/scan/${property.PropertyID}`;

        return (
            <div className="space-y-6">
                {/* Hero Header Card */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2 flex-1 min-w-[280px]">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                    <Tag className="w-3.5 h-3.5" />
                                    Property #{propertyNo}
                                </span>
                                {propertyCardNo !== '-' && (
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                        Card: {propertyCardNo}
                                    </span>
                                )}
                                <span
                                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${isUnserviceable
                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        }`}
                                >
                                    {condition}
                                </span>
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">
                                    {status}
                                </span>
                            </div>

                            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug pt-1">
                                {itemName}
                            </h2>
                            <p className="text-sm text-slate-500 font-medium">
                                {article} • {classification}
                            </p>
                        </div>

                        {/* Top Action Buttons */}
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleCopyDetails}
                                className="flex items-center gap-1.5 text-slate-700"
                            >
                                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                <span>{copied ? 'Copied' : 'Copy Info'}</span>
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleReset}
                                className="flex items-center gap-1.5 text-slate-700"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>New Search</span>
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Detailed Information Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {/* 1. Item Specifications */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3.5">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                            <Package className="w-4 h-4 text-blue-600" />
                            <span>Asset Specifications</span>
                        </div>

                        <div className="space-y-2.5 text-sm">
                            <div>
                                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Property Number</span>
                                <div className="font-semibold text-slate-900">{propertyNo}</div>
                            </div>
                            <div>
                                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Article</span>
                                <div className="text-slate-800">{article}</div>
                            </div>
                            <div>
                                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Brand / Model / Serial</span>
                                <div className="text-slate-800 break-words">{brandModelSerial}</div>
                            </div>
                            <div>
                                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Classification</span>
                                <div className="text-slate-800">{classification} ({propertyType})</div>
                            </div>
                            <div>
                                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Unit Cost / Acquisition Value</span>
                                <div className="text-base font-bold text-emerald-700">{unitCost}</div>
                            </div>
                            <div>
                                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Unit of Measure</span>
                                <div className="text-slate-800">{detail?.unitOfMeasure?.UnitName || 'Unit'}</div>
                            </div>
                        </div>
                    </div>

                    {/* 2. Custody & Accountability */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3.5">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                            <User className="w-4 h-4 text-purple-600" />
                            <span>Custody & Location</span>
                        </div>

                        <div className="space-y-2.5 text-sm">
                            <div>
                                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Accountable Officer / End User</span>
                                <div className="text-base font-bold text-slate-900 flex items-center gap-1.5 mt-0.5">
                                    <User className="w-4 h-4 text-slate-400" />
                                    {endUser}
                                </div>
                            </div>
                            <div>
                                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Assigned Department / Office</span>
                                <div className="font-medium text-slate-800 flex items-center gap-1.5 mt-0.5">
                                    <Building2 className="w-4 h-4 text-slate-400" />
                                    {department}
                                </div>
                            </div>
                            <div>
                                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Department Head</span>
                                <div className="text-slate-800">{deptHead}</div>
                            </div>
                            <div>
                                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Date Assigned</span>
                                <div className="text-slate-800 flex items-center gap-1.5 mt-0.5">
                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                    {formatDate(property.AssignedDate)}
                                </div>
                            </div>
                            <div>
                                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Remarks / Condition Note</span>
                                <div className="text-slate-700 italic">{property.Remarks || 'No remarks recorded.'}</div>
                            </div>
                        </div>
                    </div>

                    {/* 3. Issuance & Document Reference */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3.5">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                            <FileCheck className="w-4 h-4 text-amber-600" />
                            <span>Issuance & Documents</span>
                        </div>

                        <div className="space-y-2.5 text-sm">
                            <div>
                                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Document Type</span>
                                <div className="font-semibold text-slate-900">{documentType}</div>
                            </div>
                            <div>
                                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Document Number</span>
                                <div className="text-slate-800">{documentNo}</div>
                            </div>
                            <div>
                                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Date Issued</span>
                                <div className="text-slate-800">{dateIssued}</div>
                            </div>
                            <div>
                                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Issued By</span>
                                <div className="text-slate-800">{issuedBy}</div>
                            </div>
                            <div>
                                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Issuance Status</span>
                                <div className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 mt-1">
                                    {issuance?.Status || 'Acknowledged'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        );
    };

    // Render unassigned inventory detail
    const renderUnassignedDetail = (item: QrUnassignedInventoryDetail) => {
        const itemName = item.Description || item.PropertyName || 'Item in Inventory';
        const propertyNo = item.PropertyNumber || `Inv-${item.InventoryDetailID}`;
        const unitCost = formatCurrency(item.UnitCost);
        const condition = item.ConditionName || 'Serviceable';
        const isUnserviceable = condition.toLowerCase().includes('unserviceable');

        return (
            <div className="space-y-6">
                <div className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2 flex-1 min-w-[280px]">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                    <Package className="w-3.5 h-3.5" />
                                    Property #{propertyNo}
                                </span>
                                <span
                                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${isUnserviceable
                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        }`}
                                >
                                    {condition}
                                </span>
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                    Unassigned Inventory
                                </span>
                            </div>

                            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug pt-1">
                                {itemName}
                            </h2>
                            <p className="text-sm text-slate-600 font-medium">
                                {item.ArticleName || 'General Item'} • {item.ClassificationName || 'Inventory'}
                            </p>
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleReset}
                            className="flex items-center gap-1.5 text-slate-700"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>New Search</span>
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Item Details */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3.5">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                            <Package className="w-4 h-4 text-blue-600" />
                            <span>Inventory Specifications</span>
                        </div>
                        <div className="space-y-2.5 text-sm">
                            <div>
                                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Property Number</span>
                                <div className="font-semibold text-slate-900">{propertyNo}</div>
                            </div>
                            <div>
                                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Article</span>
                                <div className="text-slate-800">{item.ArticleName || '-'}</div>
                            </div>
                            <div>
                                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Brand / Model / Serial</span>
                                <div className="text-slate-800">
                                    {[item.Brand, item.ModelNumber, item.SerialNumber ? `S/N: ${item.SerialNumber}` : null]
                                        .filter(Boolean)
                                        .join(' • ') || 'None specified'}
                                </div>
                            </div>
                            <div>
                                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Classification</span>
                                <div className="text-slate-800">{item.ClassificationName || '-'}</div>
                            </div>
                            <div>
                                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Unit Cost</span>
                                <div className="text-base font-bold text-emerald-700">{unitCost}</div>
                            </div>
                        </div>
                    </div>

                    {/* Delivery Information */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3.5">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                            <FileText className="w-4 h-4 text-indigo-600" />
                            <span>Delivery Receipt Information</span>
                        </div>
                        <div className="space-y-2.5 text-sm">
                            <div>
                                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">DR Number</span>
                                <div className="font-semibold text-slate-900">{item.DRNumber || 'Not recorded'}</div>
                            </div>
                            <div>
                                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Date Received</span>
                                <div className="text-slate-800">{formatDate(item.DateAcquired)}</div>
                            </div>
                            <div>
                                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Supplier</span>
                                <div className="text-slate-800">{item.Supplier || 'Not recorded'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div
            className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat print:hidden"
            style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: 'fixed' }}
        >
            <div className="p-4 sm:p-6 lg:p-8 space-y-6 w-full">
                {/* Search Panel Card */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 lg:p-8 shadow-sm space-y-5">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start lg:items-center justify-between gap-3 sm:gap-4">
                        <div className="flex-1 min-w-0">
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
                                <Search className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 flex-shrink-0" />
                                <span>Search Property</span>
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                                Enter a property number to search and inspect complete asset specifications, custody, and issuance records.
                            </p>
                        </div>

                        {assetResult && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleReset}
                                className="self-start sm:self-center lg:self-auto flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 px-3 py-2 shrink-0"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Clear Screen</span>
                            </Button>
                        )}
                    </div>

                    {/* Search Input Form */}
                    <form onSubmit={handleFormSubmit} className="space-y-3">
                        <div className="flex flex-col sm:flex-row items-stretch gap-3">
                            <div className="relative flex-1 min-w-0">
                                <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Property No. : 2026-000003"
                                    className="w-full rounded-xl border border-slate-300 bg-white pl-11 pr-10 py-3 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm"
                                />
                                {input && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setInput('');
                                            inputRef.current?.focus();
                                        }}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            <Button
                                type="submit"
                                disabled={loading || !input.trim()}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 font-medium rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm sm:w-auto w-full sm:min-w-[140px] lg:min-w-[160px]"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                <span>Search</span>
                            </Button>
                        </div>
                    </form>

                    {/* Recent Searches / Session History */}
                    {history.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-slate-500 flex items-center gap-1 font-medium mr-1">
                                <History className="w-3.5 h-3.5" />
                                Recent:
                            </span>
                            {history.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => handleQuickSelect(item.propertyNumber)}
                                    className={`px-2.5 py-1 rounded-lg border font-mono transition-colors text-xs ${lastQuery === item.propertyNumber
                                        ? 'bg-blue-50 text-blue-700 border-blue-200 font-semibold'
                                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                        }`}
                                    title={item.description}
                                >
                                    {item.propertyNumber}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => setHistory([])}
                                className="text-slate-400 hover:text-slate-600 underline ml-auto text-[11px]"
                            >
                                Clear History
                            </button>
                        </div>
                    )}
                </div>

                {/* Error Alert */}
                {error && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/90 backdrop-blur-sm p-4 text-sm text-rose-800 flex items-center gap-3 shadow-sm">
                        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                        <div className="font-medium text-rose-900">{error}</div>
                    </div>
                )}

                {/* Initial Empty State */}
                {!assetResult && !error && !loading && (
                    <div className="rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-sm p-8 sm:p-12 shadow-sm text-center space-y-4">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mx-auto shadow-sm">
                            <Search className="w-7 h-7 sm:w-8 sm:h-8" />
                        </div>
                        <div className="max-w-md mx-auto space-y-1.5">
                            <h3 className="text-base sm:text-lg font-bold text-slate-900">Search Property Record</h3>
                            <p className="text-sm text-slate-500">
                                Enter a property number in the search bar above (e.g. <span className="font-mono text-slate-700 font-medium">2026-000003</span>) and press Enter to view all its assigned specifications, current custodian, and issuance details.
                            </p>
                        </div>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs">
                            <Shield className="w-3.5 h-3.5 text-blue-600" />
                            <span>Instant lookup without affecting active inventory cycle counts</span>
                        </div>
                    </div>
                )}

                {/* Display Asset Profile when found */}
                {assetResult && (
                    <div className="space-y-6">
                        {assetResult.type === 'assigned' && assetResult.property
                            ? renderAssignedProperty(assetResult.property, assetResult.latest_issuance_detail)
                            : assetResult.inventory_detail
                                ? renderUnassignedDetail(assetResult.inventory_detail)
                                : null}
                    </div>
                )}
            </div>
        </div>
    );
}

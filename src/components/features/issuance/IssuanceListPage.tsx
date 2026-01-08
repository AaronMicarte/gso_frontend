'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    Plus,
    Eye,
    Clock,
    CheckCircle,
    AlertCircle,
    Search,
    RefreshCw,
    Package,
    Download,
    Archive
} from 'lucide-react';
import issuanceAPI from '@/lib/api/issuance';
import { AssetIssuance, AssetIssuanceFilters } from '@/types/assetIssuance';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { toast } from 'sonner';

const statusConfig = {
    pending_acknowledgment: {
        label: 'Pending Acknowledgment',
        color: 'bg-yellow-100 text-yellow-800',
        icon: Clock
    },
    acknowledged: {
        label: 'Acknowledged',
        color: 'bg-green-100 text-green-800',
        icon: CheckCircle
    },
    returned: {
        label: 'Returned',
        color: 'bg-blue-100 text-blue-800',
        icon: AlertCircle
    },
    disposed: {
        label: 'Disposed',
        color: 'bg-gray-100 text-gray-800',
        icon: Archive
    },
};

const documentTypeConfig = {
    PAR: {
        label: 'PAR',
        color: 'bg-purple-100 text-purple-800',
        fullName: 'Property Acknowledgment Receipt'
    },
    ICS: {
        label: 'ICS',
        color: 'bg-indigo-100 text-indigo-800',
        fullName: 'Inventory Custodian Slip'
    },
};

interface IssuanceListPageProps {
    baseRoute: string;
    canIssue?: boolean;
    isAdmin?: boolean;
}

export function IssuanceListPage({ baseRoute, canIssue = false }: IssuanceListPageProps) {
    const [issuances, setIssuances] = useState<AssetIssuance[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState<AssetIssuanceFilters>({
        status: undefined,
        document_type: undefined,
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const loadIssuances = useCallback(async (page = 1) => {
        try {
            setLoading(true);
            const response = await issuanceAPI.getAll({
                ...filters,
                page,
                per_page: 15,
            });

            setIssuances(response.data);
            setCurrentPage(response.current_page);
            setTotalPages(response.last_page);
        } catch (error) {
            console.error('Failed to load issuances:', error);
            toast.error('Failed to load asset issuances');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        loadIssuances(1);
    }, [loadIssuances]);

    const handleRefresh = () => {
        loadIssuances(currentPage);
    };

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            loadIssuances(page);
        }
    };

    const handleDownloadDocument = async (issuance: AssetIssuance) => {
        try {
            const blob = await issuanceAPI.generateDocument(issuance.IssuanceID, issuance.DocumentType);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `${issuance.DocumentNumber}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            toast.success(`Downloaded ${issuance.DocumentNumber}`);
        } catch (error) {
            console.error('Failed to download document:', error);
            toast.error('Failed to download document');
        }
    };

    const filteredIssuances = issuances.filter(issuance => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        return (
            issuance.DocumentNumber.toLowerCase().includes(searchLower) ||
            issuance.issuedToUser?.FullName.toLowerCase().includes(searchLower) ||
            issuance.inventoryDetail?.propertyInventory?.ItemDescription?.toLowerCase().includes(searchLower)
        );
    });

    return (
        <div className="min-h-screen bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')" }}>
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Asset Issuances</h1>
                        <p className="text-slate-500 text-sm">
                            Manage property issuance records (PAR/ICS)
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleRefresh}
                            disabled={loading}
                            className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                        {canIssue && (
                            <Link
                                href={`${baseRoute}/new`}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                New Issuance
                            </Link>
                        )}
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                            <div>
                                <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                                    Status
                                </label>
                                <select
                                    id="status"
                                    name="status"
                                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-[var(--primary)] focus:border-[var(--primary)] sm:text-sm rounded-md"
                                    value={filters.status || ''}
                                    onChange={(e) => setFilters({
                                        ...filters,
                                        status: e.target.value as AssetIssuance['Status'] || undefined
                                    })}
                                >
                                    <option value="">All Statuses</option>
                                    <option value="pending_acknowledgment">Pending Acknowledgment</option>
                                    <option value="acknowledged">Acknowledged</option>
                                    <option value="returned">Returned</option>
                                    <option value="disposed">Disposed</option>
                                </select>
                            </div>

                            <div>
                                <label htmlFor="document_type" className="block text-sm font-medium text-gray-700">
                                    Document Type
                                </label>
                                <select
                                    id="document_type"
                                    name="document_type"
                                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-[var(--primary)] focus:border-[var(--primary)] sm:text-sm rounded-md"
                                    value={filters.document_type || ''}
                                    onChange={(e) => setFilters({
                                        ...filters,
                                        document_type: e.target.value as 'PAR' | 'ICS' || undefined
                                    })}
                                >
                                    <option value="">All Types</option>
                                    <option value="PAR">PAR (Property Acknowledgment Receipt)</option>
                                    <option value="ICS">ICS (Inventory Custodian Slip)</option>
                                </select>
                            </div>

                            <div>
                                <label htmlFor="search" className="block text-sm font-medium text-gray-700">
                                    Search
                                </label>
                                <div className="mt-1 relative rounded-md shadow-sm">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Search className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                        type="text"
                                        name="search"
                                        id="search"
                                        className="focus:ring-[var(--primary)] focus:border-[var(--primary)] block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                                        placeholder="Document number, recipient, item..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex items-end">
                                <button
                                    onClick={handleRefresh}
                                    disabled={loading}
                                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)] disabled:opacity-50"
                                >
                                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                    Refresh
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Issuances Table */}
                <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                    <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <Package className="w-5 h-5 text-gray-400 mr-2" />
                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                    Asset Issuances ({filteredIssuances.length})
                                </h3>
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center p-12">
                            <div className="flex items-center">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]"></div>
                                <span className="ml-2 text-gray-600">Loading issuances...</span>
                            </div>
                        </div>
                    ) : filteredIssuances.length === 0 ? (
                        <div className="text-center py-12">
                            <Package className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-sm font-medium text-gray-900">No asset issuances</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                {canIssue ? 'Get started by creating a new issuance.' : 'No issuances found matching your criteria.'}
                            </p>
                            {canIssue && (
                                <div className="mt-6">
                                    <Link
                                        href={`${baseRoute}/new`}
                                        className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)]"
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        New Issuance
                                    </Link>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Document
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Item Details
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Recipient
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Issue Date
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Status
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredIssuances.map((issuance) => {
                                        const StatusIcon = statusConfig[issuance.Status].icon;
                                        const issuanceDate = toZonedTime(new Date(issuance.IssuanceDate), 'Asia/Manila');

                                        return (
                                            <tr key={issuance.IssuanceID} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div className="flex-shrink-0">
                                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${documentTypeConfig[issuance.DocumentType].color}`}>
                                                                {issuance.DocumentType}
                                                            </span>
                                                        </div>
                                                        <div className="ml-3">
                                                            <div className="text-sm font-medium text-gray-900">
                                                                {issuance.DocumentNumber}
                                                            </div>
                                                            <div className="text-sm text-gray-500">
                                                                {documentTypeConfig[issuance.DocumentType].fullName}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {issuance.inventoryDetail?.propertyInventory?.ItemDescription || 'N/A'}
                                                    </div>
                                                    <div className="text-sm text-gray-500">
                                                        Qty: {issuance.QuantityIssued} {issuance.inventoryDetail?.unitOfMeasure?.UnitName || ''}
                                                    </div>
                                                    {issuance.inventoryDetail?.propertyInventory?.Brand && (
                                                        <div className="text-sm text-gray-500">
                                                            {issuance.inventoryDetail.propertyInventory.Brand}
                                                            {issuance.inventoryDetail.propertyInventory.ModelNumber &&
                                                                ` - ${issuance.inventoryDetail.propertyInventory.ModelNumber}`
                                                            }
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {issuance.issuedToUser?.FullName || 'N/A'}
                                                    </div>
                                                    {issuance.issuedToUser?.department && (
                                                        <div className="text-sm text-gray-500">
                                                            {issuance.issuedToUser.department.DepartmentName}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">
                                                        {format(issuanceDate, 'MMM d, yyyy')}
                                                    </div>
                                                    <div className="text-sm text-gray-500">
                                                        {format(issuanceDate, 'h:mm a')}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig[issuance.Status].color}`}>
                                                        <StatusIcon className="w-3 h-3 mr-1" />
                                                        {statusConfig[issuance.Status].label}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                                    <Link
                                                        href={`${baseRoute}/${issuance.IssuanceID}`}
                                                        className="inline-flex items-center text-[var(--primary)] hover:text-[var(--primary-dark)]"
                                                        title="View Details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Link>
                                                    <button
                                                        onClick={() => handleDownloadDocument(issuance)}
                                                        className="inline-flex items-center text-gray-600 hover:text-gray-900"
                                                        title="Download Document"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                            <div className="flex-1 flex justify-between sm:hidden">
                                <button
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm text-gray-700">
                                        Page <span className="font-medium">{currentPage}</span> of{' '}
                                        <span className="font-medium">{totalPages}</span>
                                    </p>
                                </div>
                                <div>
                                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                        <button
                                            onClick={() => handlePageChange(currentPage - 1)}
                                            disabled={currentPage === 1}
                                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Previous
                                        </button>
                                        <button
                                            onClick={() => handlePageChange(currentPage + 1)}
                                            disabled={currentPage === totalPages}
                                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Next
                                        </button>
                                    </nav>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
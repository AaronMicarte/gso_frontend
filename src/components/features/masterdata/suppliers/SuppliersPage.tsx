'use client';

import { useEffect, useState } from 'react';
import { useSuppliers, useSupplier, useCreateSupplier, useDeleteSupplier, useUpdateSupplier } from '@/lib/hooks/masterData';
import { Supplier, SupplierInput } from '@/types/masterData';
import { ApiError } from '@/types/api';
import { FormDialog } from '@/components/ui/FormDialog';
import { Dialog as ConfirmDialog } from '@/components/ui/Dialog';
import { Plus, Search, Edit, Trash2, Truck, RefreshCw, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface SuppliersPageProps {
    baseRoute: string;
    canEdit?: boolean;
    canDelete?: boolean;
}

export function SuppliersPage({ baseRoute: _baseRoute, canEdit = true, canDelete = true }: SuppliersPageProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
    const [activeSupplierId, setActiveSupplierId] = useState<number | null>(null);
    const [formData, setFormData] = useState<SupplierInput>({
        name: '',
        contact_person: '',
        contact_number: '',
        email: '',
        address: '',
        is_active: true,
    });
    const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});
    const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

    // Use React Query for cached data fetching
    const { data, isLoading, error, refetch } = useSuppliers({
        search: debouncedSearch || undefined,
        page: currentPage,
        per_page: 15,
        sort_by: 'id',
        sort_order: 'desc',
    });

    const deleteMutation = useDeleteSupplier();
    const createMutation = useCreateSupplier();
    const updateMutation = useUpdateSupplier();
    const { data: activeSupplier, isLoading: isLoadingSupplier } = useSupplier(activeSupplierId);

    const suppliers = data?.data || [];
    const pagination = data;

    // Debounce search to avoid too many API calls
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setCurrentPage(1);
        }, 300);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    const openCreateModal = () => {
        setFormMode('create');
        setActiveSupplierId(null);
        setFormErrors({});
        setFormData({
            name: '',
            contact_person: '',
            contact_number: '',
            email: '',
            address: '',
            is_active: true,
        });
        setFormOpen(true);
    };

    const openEditModal = (id: number) => {
        setFormMode('edit');
        setActiveSupplierId(id);
        setFormErrors({});
        setFormOpen(true);
    };

    const handleDelete = (id: number, name: string) => {
        setDeleteTarget({ id, name });
    };

    const handleDeleteConfirm = () => {
        if (!deleteTarget) return;
        deleteMutation.mutate(deleteTarget.id, {
            onSuccess: () => setDeleteTarget(null),
        });
    };

    const handleSearch = (value: string) => {
        setSearchTerm(value);
    };

    const handleRefresh = () => {
        refetch();
        toast.success('Suppliers refreshed');
    };

    useEffect(() => {
        if (formMode === 'edit' && activeSupplier) {
            const nextFormData: SupplierInput = {
                name: activeSupplier.name,
                contact_person: activeSupplier.contact_person || '',
                contact_number: activeSupplier.contact_number || '',
                email: activeSupplier.email || '',
                address: activeSupplier.address || '',
                is_active: activeSupplier.is_active,
            };

            const timer = setTimeout(() => {
                setFormData(nextFormData);
            }, 0);

            return () => clearTimeout(timer);
        }
    }, [activeSupplier, formMode]);

    const handleFormChange = (field: keyof SupplierInput, value: string | boolean) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        if (formErrors[field as string]) {
            setFormErrors((prev) => {
                const nextErrors = { ...prev };
                delete nextErrors[field as string];
                return nextErrors;
            });
        }
    };

    const handleFormError = (error: unknown) => {
        const apiError = error as ApiError;
        const backendErrors = apiError?.response?.data?.errors;

        if (!backendErrors) {
            return;
        }

        const mappedErrors: Record<string, string[]> = {};
        if (backendErrors.name) mappedErrors.name = backendErrors.name;
        if (backendErrors.contact_person) mappedErrors.contact_person = backendErrors.contact_person;
        if (backendErrors.contact_number) mappedErrors.contact_number = backendErrors.contact_number;
        if (backendErrors.email) mappedErrors.email = backendErrors.email;
        if (backendErrors.address) mappedErrors.address = backendErrors.address;
        if (backendErrors.SupplierName) mappedErrors.name = backendErrors.SupplierName;
        if (backendErrors.ContactPerson) mappedErrors.contact_person = backendErrors.ContactPerson;
        if (backendErrors.ContactNumber) mappedErrors.contact_number = backendErrors.ContactNumber;
        if (backendErrors.Email) mappedErrors.email = backendErrors.Email;
        if (backendErrors.Address) mappedErrors.address = backendErrors.Address;

        setFormErrors(mappedErrors);

        if (Object.keys(mappedErrors).length === 0 && Object.keys(backendErrors).length > 0) {
            toast.error('Please check the form for errors');
        }
    };

    const handleFormSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        setFormErrors({});

        const payload: SupplierInput = {
            name: formData.name.trim(),
            contact_person: formData.contact_person?.trim() || undefined,
            contact_number: formData.contact_number?.trim() || undefined,
            email: formData.email?.trim() || undefined,
            address: formData.address?.trim() || undefined,
            is_active: formData.is_active ?? true,
        };

        if (formMode === 'create') {
            createMutation.mutate(payload, {
                onSuccess: () => setFormOpen(false),
                onError: handleFormError,
            });
            return;
        }

        if (activeSupplierId) {
            updateMutation.mutate(
                { id: activeSupplierId, data: payload },
                {
                    onSuccess: () => setFormOpen(false),
                    onError: handleFormError,
                }
            );
        }
    };

    const isSaving = createMutation.isPending || updateMutation.isPending;

    return (
        <div className="min-h-screen bg-app print:hidden">
            {/* Header */}
            <div className="bg-white border-b border-slate-200">
                <div className="px-4 sm:px-6 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h1 id="main-content" className="text-xl sm:text-2xl font-bold text-slate-800">
                                Suppliers
                            </h1>
                            <p className="text-sm text-slate-500 mt-1">Manage suppliers</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleRefresh}
                                disabled={isLoading}
                                className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                                aria-label="Refresh suppliers list"
                            >
                                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                                <span className="hidden sm:inline">Refresh</span>
                            </button>
                            {canEdit && (
                                <button
                                    onClick={openCreateModal}
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors w-full sm:w-auto focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2"
                                    aria-label="Create new supplier"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add Supplier
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="p-4 sm:p-6 lg:p-8">
                {/* Search Bar */}
                <div className="bg-white rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" aria-hidden="true" />
                        <input
                            type="search"
                            placeholder="Search suppliers..."
                            value={searchTerm}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                            aria-label="Search suppliers by name"
                        />
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6" role="alert">
                        <strong>Error:</strong> {error?.message || 'Failed to load suppliers'}
                    </div>
                )}

                {/* Loading State */}
                {isLoading ? (
                    <div className="bg-white rounded-lg p-8">
                        <div className="space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <div key={`skeleton-${i}`} className="h-16 bg-slate-100 rounded animate-pulse" />
                            ))}
                        </div>
                    </div>
                ) : suppliers.length === 0 ? (
                    // Empty State
                    <div className="bg-white rounded-lg p-12 text-center">
                        <Truck className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-700 mb-2">No suppliers found</h3>
                        <p className="text-slate-500 mb-6">
                            {searchTerm
                                ? 'Try adjusting your search terms'
                                : 'Get started by creating your first supplier'}
                        </p>
                        {!searchTerm && (
                            <button
                                onClick={openCreateModal}
                                className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
                            >
                                Add Supplier
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Mobile Card View */}
                        <div className="lg:hidden space-y-3">
                            {suppliers.map((supplier: Supplier) => (
                                <div
                                    key={`mobile-supplier-${supplier.id}`}
                                    className="bg-white rounded-lg p-4"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-slate-900 mb-1">
                                                {supplier.name}
                                            </h3>
                                            <p className="text-sm text-slate-600">
                                                {supplier.contact_person || 'No contact person'}
                                            </p>
                                            <p className="text-sm text-slate-500 mt-1">
                                                {supplier.email || 'No email'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs text-slate-500">
                                                {supplier.contact_number || '-'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {canEdit && (
                                                <button
                                                    onClick={() => openEditModal(supplier.id)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                            )}
                                            {canDelete && (
                                                <button
                                                    onClick={() => handleDelete(supplier.id, supplier.name)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden lg:block bg-white rounded-lg overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                                Supplier Name
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                                Contact Person
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                                Email
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                                Contact Number
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {suppliers.map((supplier: Supplier) => (
                                            <tr key={`desktop-supplier-${supplier.id}`} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-slate-900">{supplier.name}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-slate-600">
                                                        {supplier.contact_person || '-'}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-slate-600">
                                                        {supplier.email || '-'}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-slate-600">
                                                        {supplier.contact_number || '-'}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {canEdit && (
                                                            <button
                                                                onClick={() => openEditModal(supplier.id)}
                                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                title="Edit"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {canDelete && (
                                                            <button
                                                                onClick={() => handleDelete(supplier.id, supplier.name)}
                                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Pagination */}
                        {pagination && pagination.last_page > 1 && (
                            <div className="mt-4 lg:mt-0 px-4 py-3 lg:px-6 lg:py-4 bg-white lg:border-t border-slate-200 rounded-lg lg:rounded-none flex flex-col sm:flex-row items-center justify-between gap-3">
                                <div className="text-sm text-slate-600">
                                    Page {pagination.current_page} of {pagination.last_page}
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <button
                                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                        disabled={pagination.current_page === 1}
                                        className="flex-1 sm:flex-initial px-4 py-2 text-sm border border-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                                    >
                                        Previous
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage((prev) => Math.min(pagination.last_page, prev + 1))}
                                        disabled={pagination.current_page === pagination.last_page}
                                        className="flex-1 sm:flex-initial px-4 py-2 text-sm border border-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
            <FormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                title={formMode === 'create' ? 'Add Supplier' : 'Edit Supplier'}
                description="Manage supplier records"
                contentClassName="max-w-3xl"
            >
                {formMode === 'edit' && isLoadingSupplier ? (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
                    </div>
                ) : (
                    <form onSubmit={handleFormSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Supplier Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => handleFormChange('name', e.target.value)}
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${formErrors.name ? 'border-red-500' : 'border-slate-300'}`}
                                placeholder="Enter supplier name"
                                required
                            />
                            {formErrors.name && <p className="mt-1 text-sm text-red-500">{formErrors.name[0]}</p>}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Contact Person</label>
                                <input
                                    type="text"
                                    value={formData.contact_person || ''}
                                    onChange={(e) => handleFormChange('contact_person', e.target.value)}
                                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${formErrors.contact_person ? 'border-red-500' : 'border-slate-300'}`}
                                    placeholder="Enter contact person"
                                />
                                {formErrors.contact_person && (
                                    <p className="mt-1 text-sm text-red-500">{formErrors.contact_person[0]}</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Contact Number</label>
                                <input
                                    type="text"
                                    value={formData.contact_number || ''}
                                    onChange={(e) => handleFormChange('contact_number', e.target.value)}
                                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${formErrors.contact_number ? 'border-red-500' : 'border-slate-300'}`}
                                    placeholder="Enter contact number"
                                />
                                {formErrors.contact_number && (
                                    <p className="mt-1 text-sm text-red-500">{formErrors.contact_number[0]}</p>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
                                <input
                                    type="email"
                                    value={formData.email || ''}
                                    onChange={(e) => handleFormChange('email', e.target.value)}
                                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${formErrors.email ? 'border-red-500' : 'border-slate-300'}`}
                                    placeholder="Enter email address"
                                />
                                {formErrors.email && <p className="mt-1 text-sm text-red-500">{formErrors.email[0]}</p>}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Address</label>
                            <textarea
                                value={formData.address || ''}
                                onChange={(e) => handleFormChange('address', e.target.value)}
                                rows={3}
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${formErrors.address ? 'border-red-500' : 'border-slate-300'}`}
                                placeholder="Enter complete address"
                            />
                            {formErrors.address && <p className="mt-1 text-sm text-red-500">{formErrors.address[0]}</p>}
                        </div>
                        <div>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={!!formData.is_active}
                                    onChange={(e) => handleFormChange('is_active', e.target.checked)}
                                    className="rounded border-slate-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                                />
                                <span className="text-sm font-medium text-slate-700">Active</span>
                            </label>
                        </div>
                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                            <button
                                type="button"
                                onClick={() => setFormOpen(false)}
                                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {isSaving ? 'Saving...' : formMode === 'create' ? 'Save Supplier' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                )}
            </FormDialog>
            <ConfirmDialog
                open={!!deleteTarget}
                onOpenChange={(open) => {
                    if (!open) setDeleteTarget(null);
                }}
                title="Delete Supplier"
                description={deleteTarget ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.` : undefined}
                confirmText="Delete"
                cancelText="Cancel"
                onConfirm={handleDeleteConfirm}
                loading={deleteMutation.isPending}
            />
        </div>
    );
}
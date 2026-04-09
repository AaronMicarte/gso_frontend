'use client';

import { useEffect, useState } from 'react';
import { Edit, Plus, RefreshCw, Search, Trash2, Wrench } from 'lucide-react';
import { toast } from 'sonner';

import { Dialog as ConfirmDialog } from '@/components/ui/Dialog';
import { FormDialog } from '@/components/ui/FormDialog';
import { TableSkeletonRows } from '@/components/ui/ListSkeletons';
import { useCreateVendor, useDeleteVendor, useUpdateVendor, useVendor, useVendors } from '@/lib/hooks/masterData/useVendors';
import { ApiError } from '@/types/api';
import { Vendor, VendorInput } from '@/types/masterData';

interface VendorsPageProps {
    canEdit?: boolean;
    canDelete?: boolean;
}

export function VendorsPage({ canEdit = true, canDelete = true }: VendorsPageProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
    const [activeVendorId, setActiveVendorId] = useState<number | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
    const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});
    const [formData, setFormData] = useState<VendorInput>({
        name: '',
        contact_person: '',
        contact_number: '',
        email: '',
        address: '',
        is_active: true,
    });

    const { data, isLoading, isFetching, error, refetch } = useVendors({
        search: debouncedSearch || undefined,
        page: currentPage,
        per_page: 15,
        sort_by: 'id',
        sort_order: 'desc',
    });

    const { data: activeVendor } = useVendor(activeVendorId);
    const createMutation = useCreateVendor();
    const updateMutation = useUpdateVendor();
    const deleteMutation = useDeleteVendor();

    const vendors = data?.data || [];

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setCurrentPage(1);
        }, 300);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        if (formMode === 'edit' && activeVendor) {
            const timer = setTimeout(() => {
                setFormData({
                    name: activeVendor.name,
                    contact_person: activeVendor.contact_person || '',
                    contact_number: activeVendor.contact_number || '',
                    email: activeVendor.email || '',
                    address: activeVendor.address || '',
                    is_active: activeVendor.is_active,
                });
            }, 0);

            return () => clearTimeout(timer);
        }
    }, [activeVendor, formMode]);

    const openCreateModal = () => {
        setFormMode('create');
        setActiveVendorId(null);
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
        setActiveVendorId(id);
        setFormErrors({});
        setFormOpen(true);
    };

    const handleFormError = (errorObj: unknown) => {
        const apiError = errorObj as ApiError;
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
        if (backendErrors.VendorName) mappedErrors.name = backendErrors.VendorName;
        if (backendErrors.ContactPerson) mappedErrors.contact_person = backendErrors.ContactPerson;
        if (backendErrors.ContactNumber) mappedErrors.contact_number = backendErrors.ContactNumber;
        if (backendErrors.Email) mappedErrors.email = backendErrors.Email;
        if (backendErrors.Address) mappedErrors.address = backendErrors.Address;

        setFormErrors(mappedErrors);
    };

    const handleFormSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        setFormErrors({});

        const payload: VendorInput = {
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

        if (activeVendorId) {
            updateMutation.mutate(
                { id: activeVendorId, data: payload },
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
            <div className="bg-white border-b border-slate-200">
                <div className="px-4 sm:px-6 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h1 id="main-content" className="text-xl sm:text-2xl font-bold text-slate-800">Repair Vendors</h1>
                            <p className="text-sm text-slate-500 mt-1">Manage repair/service vendors</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    refetch();
                                    toast.success('Vendors refreshed');
                                }}
                                disabled={isFetching}
                                className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                            >
                                <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                                <span className="hidden sm:inline">Refresh</span>
                            </button>
                            {canEdit && (
                                <button
                                    onClick={openCreateModal}
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add Vendor
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-4 sm:p-6 lg:p-8">
                <div className="bg-white rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" aria-hidden="true" />
                        <input
                            type="search"
                            placeholder="Search vendors..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                        />
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6" role="alert">
                        <strong>Error:</strong> {error?.message || 'Failed to load vendors'}
                    </div>
                )}

                {isLoading ? (
                    <div className="bg-white rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <tbody className="divide-y divide-slate-200">
                                    <TableSkeletonRows columns={5} rows={10} />
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : vendors.length === 0 ? (
                    <div className="bg-white rounded-lg p-12 text-center">
                        <Wrench className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-700 mb-2">No vendors found</h3>
                        <p className="text-slate-500 mb-6">Add your first repair vendor to start tracking service transactions.</p>
                        {canEdit && (
                            <button
                                onClick={openCreateModal}
                                className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
                            >
                                Add Vendor
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="bg-white rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Vendor Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Contact Person</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Email</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Contact Number</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {vendors.map((vendor: Vendor) => (
                                        <tr key={`vendor-${vendor.id}`} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 text-sm font-medium text-slate-900">{vendor.name}</td>
                                            <td className="px-6 py-4 text-sm text-slate-600">{vendor.contact_person || '-'}</td>
                                            <td className="px-6 py-4 text-sm text-slate-600">{vendor.email || '-'}</td>
                                            <td className="px-6 py-4 text-sm text-slate-600">{vendor.contact_number || '-'}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="inline-flex items-center gap-2">
                                                    {canEdit && (
                                                        <button
                                                            onClick={() => openEditModal(vendor.id)}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title="Edit"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {canDelete && (
                                                        <button
                                                            onClick={() => setDeleteTarget({ id: vendor.id, name: vendor.name })}
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
                )}
            </div>

            <FormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                title={formMode === 'create' ? 'Add Repair Vendor' : 'Edit Repair Vendor'}
            >
                <form onSubmit={handleFormSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Vendor Name</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)]"
                            required
                        />
                        {formErrors.name && <p className="text-xs text-red-600 mt-1">{formErrors.name[0]}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Contact Person</label>
                        <input
                            type="text"
                            value={formData.contact_person}
                            onChange={(e) => setFormData((prev) => ({ ...prev, contact_person: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)]"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Contact Number</label>
                        <input
                            type="text"
                            value={formData.contact_number}
                            onChange={(e) => setFormData((prev) => ({ ...prev, contact_number: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)]"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)]"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Address</label>
                        <textarea
                            value={formData.address}
                            onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                            rows={3}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)]"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            id="vendor-is-active"
                            type="checkbox"
                            checked={formData.is_active}
                            onChange={(e) => setFormData((prev) => ({ ...prev, is_active: e.target.checked }))}
                        />
                        <label htmlFor="vendor-is-active" className="text-sm text-slate-700">Active</label>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 border border-slate-300 rounded-lg">
                            Cancel
                        </button>
                        <button type="submit" disabled={isSaving} className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg disabled:opacity-50">
                            {isSaving ? 'Saving...' : formMode === 'create' ? 'Create Vendor' : 'Update Vendor'}
                        </button>
                    </div>
                </form>
            </FormDialog>

            <ConfirmDialog
                open={!!deleteTarget}
                onOpenChange={(open) => {
                    if (!open) setDeleteTarget(null);
                }}
                title="Delete Vendor"
                description={deleteTarget ? `Delete ${deleteTarget.name}? This action can be restored from deleted records.` : ''}
                confirmText="Delete"
                cancelText="Cancel"
                onConfirm={() => {
                    if (!deleteTarget) return;
                    deleteMutation.mutate(deleteTarget.id, {
                        onSuccess: () => setDeleteTarget(null),
                    });
                }}
                loading={deleteMutation.isPending}
            />
        </div>
    );
}

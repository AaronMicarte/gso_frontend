'use client';

import { useEffect, useState } from 'react';
import { useDepartments, useDepartment, useCreateDepartment, useDeleteDepartment, useUpdateDepartment } from '@/lib/hooks/masterData';
import { Department, DepartmentInput } from '@/types/masterData';
import { ApiError } from '@/types/api';
import { FormDialog } from '@/components/ui/FormDialog';
import { Dialog as ConfirmDialog } from '@/components/ui/Dialog';
import { TableSkeletonRows } from '@/components/ui/ListSkeletons';
import { Plus, Search, Edit, Trash2, Building2, RefreshCw, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface DepartmentsPageProps {
    baseRoute: string;
    canEdit?: boolean;
    canDelete?: boolean;
}

export function DepartmentsPage({ baseRoute: _baseRoute, canEdit = true, canDelete = true }: DepartmentsPageProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
    const [activeDepartmentId, setActiveDepartmentId] = useState<number | null>(null);
    const [formData, setFormData] = useState<DepartmentInput>({
        DepartmentCode: '',
        DepartmentName: '',
        Description: '',
    });
    const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});
    const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

    // Use React Query for cached data fetching
    const { data, isLoading, isFetching, error, refetch } = useDepartments({
        search: debouncedSearch || undefined,
        page: currentPage,
        per_page: 15,
        // alphabetical A–Z
        sort_by: 'DepartmentName',
        sort_order: 'asc',
    });

    const deleteMutation = useDeleteDepartment();
    const createMutation = useCreateDepartment();
    const updateMutation = useUpdateDepartment();
    const { data: activeDepartment, isLoading: isLoadingDepartment } = useDepartment(activeDepartmentId);

    const departments: Department[] = data?.data || [];
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
        setActiveDepartmentId(null);
        setFormErrors({});
        setFormData({
            DepartmentCode: '',
            DepartmentName: '',
            Description: '',
        });
        setFormOpen(true);
    };

    const openEditModal = (id: number) => {
        setFormMode('edit');
        setActiveDepartmentId(id);
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
        toast.success('Departments refreshed');
    };

    useEffect(() => {
        if (formMode === 'edit' && activeDepartment) {
            const nextFormData: DepartmentInput = {
                DepartmentCode: activeDepartment.code || '',
                DepartmentName: activeDepartment.name || '',
                Description: activeDepartment.description || '',
            };

            const timer = setTimeout(() => {
                setFormData(nextFormData);
            }, 0);

            return () => clearTimeout(timer);
        }
    }, [activeDepartment, formMode]);

    const handleFormChange = (field: keyof DepartmentInput, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        if (formErrors[field]) {
            setFormErrors((prev) => {
                const nextErrors = { ...prev };
                delete nextErrors[field];
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
        if (backendErrors.DepartmentCode) mappedErrors.DepartmentCode = backendErrors.DepartmentCode;
        if (backendErrors.DepartmentName) mappedErrors.DepartmentName = backendErrors.DepartmentName;
        if (backendErrors.Description) mappedErrors.Description = backendErrors.Description;

        setFormErrors(mappedErrors);

        if (Object.keys(mappedErrors).length === 0 && Object.keys(backendErrors).length > 0) {
            toast.error('Please check the form for errors');
        }
    };

    const handleFormSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        setFormErrors({});

        const payload: DepartmentInput = {
            DepartmentCode: formData.DepartmentCode.trim(),
            DepartmentName: formData.DepartmentName.trim(),
            Description: formData.Description?.trim() || '',
        };

        if (formMode === 'create') {
            createMutation.mutate(payload, {
                onSuccess: () => setFormOpen(false),
                onError: handleFormError,
            });
            return;
        }

        if (activeDepartmentId) {
            updateMutation.mutate(
                { id: activeDepartmentId, data: payload },
                {
                    onSuccess: () => setFormOpen(false),
                    onError: handleFormError,
                }
            );
        }
    };

    const isSaving = createMutation.isPending || updateMutation.isPending;

    const renderPaginationFooter = () => {
        if (
            !pagination ||
            typeof pagination.current_page !== 'number' ||
            typeof pagination.last_page !== 'number' ||
            typeof pagination.per_page !== 'number' ||
            typeof pagination.total !== 'number' ||
            pagination.last_page <= 1
        ) {
            return null;
        }

        const start = ((pagination.current_page - 1) * pagination.per_page) + 1;
        const end = Math.min(pagination.current_page * pagination.per_page, pagination.total);

        return (
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-600">
                        Showing {start} to {end} of {pagination.total} entries
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                            disabled={pagination.current_page === 1 || isFetching}
                            className="px-3 py-1 text-sm border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>
                        <span className="text-sm text-slate-600">
                            Page {pagination.current_page} of {pagination.last_page}
                        </span>
                        <button
                            onClick={() => setCurrentPage((prev) => Math.min(pagination.last_page, prev + 1))}
                            disabled={pagination.current_page === pagination.last_page || isFetching}
                            className="px-3 py-1 text-sm border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-app print:hidden">
            {/* Header */}
            <div className="bg-white border-b border-slate-200">
                <div className="px-4 sm:px-6 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h1 id="main-content" className="text-xl sm:text-2xl font-bold text-slate-800">
                                Departments
                            </h1>
                            <p className="text-sm text-slate-500 mt-1">Manage organization departments</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleRefresh}
                                disabled={isFetching}
                                className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                                aria-label="Refresh departments list"
                            >
                                <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                                <span className="hidden sm:inline">Refresh</span>
                            </button>
                            {canEdit && (
                                <button
                                    onClick={openCreateModal}
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors w-full sm:w-auto focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2"
                                    aria-label="Create new department"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add Department
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
                            placeholder="Search departments..."
                            value={searchTerm}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                            aria-label="Search departments by name or code"
                        />
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6" role="alert">
                        <strong>Error:</strong> {error?.message || 'Failed to load departments'}
                    </div>
                )}

                {/* Loading State */}
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
                ) : departments.length === 0 ? (
                    // Empty State
                    <div className="bg-white rounded-lg p-12 text-center">
                        <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-700 mb-2">No departments found</h3>
                        <p className="text-slate-500 mb-6">
                            {searchTerm
                                ? 'Try adjusting your search terms'
                                : 'Get started by creating your first department'}
                        </p>
                        {!searchTerm && (
                            <button
                                onClick={openCreateModal}
                                className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
                                aria-label="Create first department"
                            >
                                Add Department
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Mobile Card View */}
                        <div className="lg:hidden space-y-3">
                            {departments.map((department: Department) => (
                                <div
                                    key={`mobile-department-${department.id}`}
                                    className="bg-white rounded-lg p-4"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-slate-900 mb-1">
                                                {department.name}
                                            </h3>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full">
                                                    {department.code}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-600">
                                                {department.description || 'No description'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                                        <span className="text-xs text-slate-500">
                                            {department.created_at
                                                ? new Date(department.created_at).toLocaleDateString('en-PH', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                })
                                                : '-'
                                            }
                                        </span>
                                        <div className="flex items-center gap-2">
                                            {canEdit && (
                                                <button
                                                    onClick={() => openEditModal(department.id)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                            )}
                                            {canDelete && (
                                                <button
                                                    onClick={() => handleDelete(department.id, department.name)}
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
                                                Department Name
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                                Code
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                                Description
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                                Created Date
                                            </th>
                                            {(canEdit || canDelete) && (
                                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                                    Actions
                                                </th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {departments.map((department: Department) => (
                                            <tr key={`desktop-department-${department.id}`} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-slate-900">{department.name}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">
                                                        {department.code}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-slate-600">
                                                        {department.description || '-'}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-slate-600">
                                                        {department.created_at
                                                            ? new Date(department.created_at).toLocaleDateString('en-PH', {
                                                                year: 'numeric',
                                                                month: 'short',
                                                                day: 'numeric',
                                                            })
                                                            : '-'
                                                        }
                                                    </div>
                                                </td>
                                                {(canEdit || canDelete) && (
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {canEdit && (
                                                                <button
                                                                    onClick={() => openEditModal(department.id)}
                                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                    title="Edit"
                                                                >
                                                                    <Edit className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            {canDelete && (
                                                                <button
                                                                    onClick={() => handleDelete(department.id, department.name)}
                                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {renderPaginationFooter()}
                    </>
                )}
            </div>
            <FormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                title={formMode === 'create' ? 'Add Department' : 'Edit Department'}
                description="Manage organization departments"
            >
                {formMode === 'edit' && isLoadingDepartment ? (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
                    </div>
                ) : (
                    <form onSubmit={handleFormSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Department Code <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.DepartmentCode}
                                onChange={(e) => handleFormChange('DepartmentCode', e.target.value)}
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${formErrors.DepartmentCode ? 'border-red-500' : 'border-slate-300'}`}
                                placeholder="e.g., ICT"
                                required
                            />
                            {formErrors.DepartmentCode && (
                                <p className="text-red-500 text-sm mt-1">{formErrors.DepartmentCode[0]}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Department Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.DepartmentName}
                                onChange={(e) => handleFormChange('DepartmentName', e.target.value)}
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${formErrors.DepartmentName ? 'border-red-500' : 'border-slate-300'}`}
                                placeholder="e.g., Information and Communications Technology"
                                required
                            />
                            {formErrors.DepartmentName && (
                                <p className="text-red-500 text-sm mt-1">{formErrors.DepartmentName[0]}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                            <textarea
                                value={formData.Description}
                                onChange={(e) => handleFormChange('Description', e.target.value)}
                                rows={4}
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${formErrors.Description ? 'border-red-500' : 'border-slate-300'}`}
                                placeholder="Optional description..."
                            />
                            {formErrors.Description && (
                                <p className="text-red-500 text-sm mt-1">{formErrors.Description[0]}</p>
                            )}
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
                                {isSaving ? 'Saving...' : formMode === 'create' ? 'Save Department' : 'Save Changes'}
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
                title="Delete Department"
                description={deleteTarget ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.` : undefined}
                confirmText="Delete"
                cancelText="Cancel"
                onConfirm={handleDeleteConfirm}
                loading={deleteMutation.isPending}
            />
        </div>
    );
}
'use client';

import { useEffect, useState } from 'react';
import {
    useEndUsers,
    useEndUser,
    useCreateEndUser,
    useDeleteEndUser,
    useUpdateEndUser,
    useAllDepartments,
    useAllPositions,
} from '@/lib/hooks/masterData';
import { EndUser, EndUserInput } from '@/types/masterData';
import { ApiError } from '@/types/api';
import { FormDialog } from '@/components/ui/FormDialog';
import { Dialog as ConfirmDialog } from '@/components/ui/Dialog';
import { Plus, Search, Edit, Trash2, Box, RefreshCw, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface EndUsersPageProps {
    baseRoute: string;
    canEdit?: boolean;
    canDelete?: boolean;
}

export function EndUsersPage({ baseRoute: _baseRoute, canEdit = true, canDelete = true }: EndUsersPageProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
    const [activeEndUserId, setActiveEndUserId] = useState<number | null>(null);
    const [formData, setFormData] = useState<EndUserInput>({
        full_name: '',
        department_id: 0,
        position_id: 0,
        contact_number: '',
        email: '',
        is_active: true,
    });
    const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});
    const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

    // Use React Query for cached data fetching
    const { data, isLoading, error, refetch } = useEndUsers({
        search: debouncedSearch || undefined,
        page: currentPage,
        per_page: 15,
        sort_by: 'id',
        sort_order: 'desc',
    });

    const deleteMutation = useDeleteEndUser();
    const createMutation = useCreateEndUser();
    const updateMutation = useUpdateEndUser();
    const { data: activeEndUser, isLoading: isLoadingEndUser } = useEndUser(activeEndUserId);
    const { data: departmentsData } = useAllDepartments();
    const { data: positionsData } = useAllPositions();

    const endUsers = data?.data || [];
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
        setActiveEndUserId(null);
        setFormErrors({});
        setFormData({
            full_name: '',
            department_id: 0,
            position_id: 0,
            contact_number: '',
            email: '',
            is_active: true,
        });
        setFormOpen(true);
    };

    const openEditModal = (id: number) => {
        setFormMode('edit');
        setActiveEndUserId(id);
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
        toast.success('End users refreshed');
    };

    useEffect(() => {
        if (formMode === 'edit' && activeEndUser) {
            const nextFormData: EndUserInput = {
                full_name: activeEndUser.full_name,
                department_id: activeEndUser.department_id,
                position_id: activeEndUser.position_id,
                contact_number: activeEndUser.contact_number || '',
                email: activeEndUser.email || '',
                is_active: activeEndUser.is_active,
            };

            const timer = setTimeout(() => {
                setFormData(nextFormData);
            }, 0);

            return () => clearTimeout(timer);
        }
    }, [activeEndUser, formMode]);

    const handleFormChange = (field: keyof EndUserInput, value: string | number | boolean) => {
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
        if (backendErrors.full_name) mappedErrors.full_name = backendErrors.full_name;
        if (backendErrors.department_id) mappedErrors.department_id = backendErrors.department_id;
        if (backendErrors.position_id) mappedErrors.position_id = backendErrors.position_id;
        if (backendErrors.contact_number) mappedErrors.contact_number = backendErrors.contact_number;
        if (backendErrors.email) mappedErrors.email = backendErrors.email;
        if (backendErrors.FullName) mappedErrors.full_name = backendErrors.FullName;
        if (backendErrors.DepartmentId) mappedErrors.department_id = backendErrors.DepartmentId;
        if (backendErrors.PositionId) mappedErrors.position_id = backendErrors.PositionId;
        if (backendErrors.ContactNumber) mappedErrors.contact_number = backendErrors.ContactNumber;
        if (backendErrors.Email) mappedErrors.email = backendErrors.Email;

        setFormErrors(mappedErrors);

        if (Object.keys(mappedErrors).length === 0 && Object.keys(backendErrors).length > 0) {
            toast.error('Please check the form for errors');
        }
    };

    const handleFormSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        setFormErrors({});

        const payload: EndUserInput = {
            full_name: formData.full_name.trim(),
            department_id: Number(formData.department_id),
            position_id: Number(formData.position_id),
            contact_number: formData.contact_number?.trim() || undefined,
            email: formData.email?.trim() || undefined,
            is_active: formData.is_active ?? true,
        };

        const validationErrors: Record<string, string[]> = {};
        if (!payload.department_id) {
            validationErrors.department_id = ['Department is required'];
        }
        if (!payload.position_id) {
            validationErrors.position_id = ['Position is required'];
        }

        if (Object.keys(validationErrors).length > 0) {
            setFormErrors(validationErrors);
            return;
        }

        if (formMode === 'create') {
            createMutation.mutate(payload, {
                onSuccess: () => setFormOpen(false),
                onError: handleFormError,
            });
            return;
        }

        if (activeEndUserId) {
            updateMutation.mutate(
                { id: activeEndUserId, data: payload },
                {
                    onSuccess: () => setFormOpen(false),
                    onError: handleFormError,
                }
            );
        }
    };

    const isSaving = createMutation.isPending || updateMutation.isPending;
    const departments = departmentsData || [];
    const positions = positionsData || [];

    return (
        <div className="min-h-screen bg-app print:hidden">
            {/* Header */}
            <div className="bg-white border-b border-slate-200">
                <div className="px-4 sm:px-6 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h1 id="main-content" className="text-xl sm:text-2xl font-bold text-slate-800">
                                End Users
                            </h1>
                            <p className="text-sm text-slate-500 mt-1">Manage end users</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleRefresh}
                                disabled={isLoading}
                                className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                                aria-label="Refresh end users list"
                            >
                                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                                <span className="hidden sm:inline">Refresh</span>
                            </button>
                            {canEdit && (
                                <button
                                    onClick={openCreateModal}
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors w-full sm:w-auto focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2"
                                    aria-label="Create new end user"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add End User
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
                            placeholder="Search end users..."
                            value={searchTerm}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                            aria-label="Search end users by name"
                        />
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6" role="alert">
                        <strong>Error:</strong> {error?.message || 'Failed to load end users'}
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
                ) : endUsers.length === 0 ? (
                    // Empty State
                    <div className="bg-white rounded-lg p-12 text-center">
                        <Box className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-700 mb-2">No end users found</h3>
                        <p className="text-slate-500 mb-6">
                            {searchTerm
                                ? 'Try adjusting your search terms'
                                : 'Get started by creating your first end user'}
                        </p>
                        {!searchTerm && (
                            <button
                                onClick={openCreateModal}
                                className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
                            >
                                Add End User
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Mobile Card View */}
                        <div className="lg:hidden space-y-3">
                            {endUsers.map((user: EndUser) => (
                                <div
                                    key={`mobile-user-${user.id}`}
                                    className="bg-white rounded-lg p-4"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-slate-900 mb-1">
                                                {user.full_name}
                                            </h3>
                                            <div className="flex flex-wrap gap-2 mb-1">
                                                <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full">
                                                    {user.email || 'No Email'}
                                                </span>
                                                <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full">
                                                    {user.department?.name || 'No Department'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                                        <span className="text-xs text-slate-500">
                                            {user.created_at
                                                ? new Date(user.created_at).toLocaleDateString('en-PH', {
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
                                                    onClick={() => openEditModal(user.id)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                            )}
                                            {canDelete && (
                                                <button
                                                    onClick={() => handleDelete(user.id, user.full_name)}
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
                                                Full Name
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                                Email
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                                Department
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                                Position
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                                Created Date
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {endUsers.map((user: EndUser) => (
                                            <tr key={`desktop-user-${user.id}`} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-slate-900">{user.full_name}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-slate-600">{user.email || '-'}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">
                                                        {user.department?.name || '-'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">
                                                        {user.position?.name || '-'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-slate-600">
                                                        {user.created_at
                                                            ? new Date(user.created_at).toLocaleDateString('en-PH', {
                                                                year: 'numeric',
                                                                month: 'short',
                                                                day: 'numeric',
                                                            })
                                                            : '-'
                                                        }
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {canEdit && (
                                                            <button
                                                                onClick={() => openEditModal(user.id)}
                                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                title="Edit"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {canDelete && (
                                                            <button
                                                                onClick={() => handleDelete(user.id, user.full_name)}
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
                title={formMode === 'create' ? 'Add End User' : 'Edit End User'}
                description="Manage end users"
                contentClassName="max-w-3xl"
            >
                {formMode === 'edit' && isLoadingEndUser ? (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
                    </div>
                ) : (
                    <form onSubmit={handleFormSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Full Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.full_name}
                                onChange={(e) => handleFormChange('full_name', e.target.value)}
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${formErrors.full_name ? 'border-red-500' : 'border-slate-300'}`}
                                placeholder="Enter full name"
                                required
                            />
                            {formErrors.full_name && (
                                <p className="text-sm text-red-600 mt-1">{formErrors.full_name[0]}</p>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Department <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.department_id}
                                    onChange={(e) => handleFormChange('department_id', Number(e.target.value))}
                                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${formErrors.department_id ? 'border-red-500' : 'border-slate-300'}`}
                                    required
                                >
                                    <option value={0}>Select department</option>
                                    {departments.map((department) => (
                                        <option key={department.id} value={department.id}>
                                            {department.name}
                                        </option>
                                    ))}
                                </select>
                                {formErrors.department_id && (
                                    <p className="text-sm text-red-600 mt-1">{formErrors.department_id[0]}</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Position <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.position_id}
                                    onChange={(e) => handleFormChange('position_id', Number(e.target.value))}
                                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${formErrors.position_id ? 'border-red-500' : 'border-slate-300'}`}
                                    required
                                >
                                    <option value={0}>Select position</option>
                                    {positions.map((position) => (
                                        <option key={position.id} value={position.id}>
                                            {position.name}
                                        </option>
                                    ))}
                                </select>
                                {formErrors.position_id && (
                                    <p className="text-sm text-red-600 mt-1">{formErrors.position_id[0]}</p>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                                <input
                                    type="email"
                                    value={formData.email || ''}
                                    onChange={(e) => handleFormChange('email', e.target.value)}
                                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${formErrors.email ? 'border-red-500' : 'border-slate-300'}`}
                                    placeholder="Enter email"
                                />
                                {formErrors.email && (
                                    <p className="text-sm text-red-600 mt-1">{formErrors.email[0]}</p>
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
                                    <p className="text-sm text-red-600 mt-1">{formErrors.contact_number[0]}</p>
                                )}
                            </div>
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
                                {isSaving ? 'Saving...' : formMode === 'create' ? 'Save End User' : 'Save Changes'}
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
                title="Delete End User"
                description={deleteTarget ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.` : undefined}
                confirmText="Delete"
                cancelText="Cancel"
                onConfirm={handleDeleteConfirm}
                loading={deleteMutation.isPending}
            />
        </div>
    );
}
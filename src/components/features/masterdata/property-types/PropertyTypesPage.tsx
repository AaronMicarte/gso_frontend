'use client';

import { useEffect, useState } from 'react';
import {
    usePropertyTypes,
    usePropertyType,
    useCreatePropertyType,
    useDeletePropertyType,
    useUpdatePropertyType,
    useAllPropertyClassifications,
} from '@/lib/hooks/masterData';
import { PropertyType, PropertyTypeInput } from '@/types/masterData';
import { ApiError } from '@/types/api';
import { FormDialog } from '@/components/ui/FormDialog';
import { Dialog as ConfirmDialog } from '@/components/ui/Dialog';
import { TableSkeletonRows } from '@/components/ui/ListSkeletons';
import { Plus, Search, Edit, Trash2, Box, RefreshCw, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface PropertyTypesPageProps {
    baseRoute: string;
}

export function PropertyTypesPage({ baseRoute: _baseRoute }: PropertyTypesPageProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
    const [activeTypeId, setActiveTypeId] = useState<number | null>(null);
    const [formData, setFormData] = useState<PropertyTypeInput>({
        name: '',
        description: '',
        property_classification_id: 0,
    });
    const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});
    const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

    // Use React Query for cached data fetching
    const { data, isLoading, isFetching, error, refetch } = usePropertyTypes({
        search: debouncedSearch || undefined,
        page: currentPage,
        per_page: 15,
        sort_by: 'id',
        sort_order: 'desc',
    });

    const deleteMutation = useDeletePropertyType();
    const createMutation = useCreatePropertyType();
    const updateMutation = useUpdatePropertyType();
    const { data: activeType, isLoading: isLoadingType } = usePropertyType(activeTypeId);
    const { data: classificationData } = useAllPropertyClassifications();

    const propertyTypes = data?.data || [];
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
        setActiveTypeId(null);
        setFormErrors({});
        setFormData({ name: '', description: '', property_classification_id: 0 });
        setFormOpen(true);
    };

    const openEditModal = (id: number) => {
        setFormMode('edit');
        setActiveTypeId(id);
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
        toast.success('Property types refreshed');
    };

    useEffect(() => {
        if (formMode === 'edit' && activeType) {
            const nextFormData: PropertyTypeInput = {
                name: activeType.name,
                description: activeType.description || '',
                property_classification_id: activeType.property_classification_id,
            };

            const timer = setTimeout(() => {
                setFormData(nextFormData);
            }, 0);

            return () => clearTimeout(timer);
        }
    }, [activeType, formMode]);

    const handleFormChange = (field: keyof PropertyTypeInput, value: string | number) => {
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
        if (backendErrors.description) mappedErrors.description = backendErrors.description;
        if (backendErrors.property_classification_id) mappedErrors.property_classification_id = backendErrors.property_classification_id;
        if (backendErrors.PropertyTypeName) mappedErrors.name = backendErrors.PropertyTypeName;
        if (backendErrors.PropertyClassificationId) mappedErrors.property_classification_id = backendErrors.PropertyClassificationId;
        if (backendErrors.Description) mappedErrors.description = backendErrors.Description;

        setFormErrors(mappedErrors);

        if (Object.keys(mappedErrors).length === 0 && Object.keys(backendErrors).length > 0) {
            toast.error('Please check the form for errors');
        }
    };

    const handleFormSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        setFormErrors({});

        const payload: PropertyTypeInput = {
            name: formData.name.trim(),
            description: formData.description?.trim() || undefined,
            property_classification_id: Number(formData.property_classification_id),
        };

        if (!payload.property_classification_id) {
            setFormErrors({ property_classification_id: ['Classification is required'] });
            return;
        }

        if (formMode === 'create') {
            createMutation.mutate(payload, {
                onSuccess: () => setFormOpen(false),
                onError: handleFormError,
            });
            return;
        }

        if (activeTypeId) {
            updateMutation.mutate(
                { id: activeTypeId, data: payload },
                {
                    onSuccess: () => setFormOpen(false),
                    onError: handleFormError,
                }
            );
        }
    };

    const isSaving = createMutation.isPending || updateMutation.isPending;
    const classifications = classificationData || [];

    return (
        <div className="min-h-screen bg-app print:hidden">
            {/* Header */}
            <div className="bg-white border-b border-slate-200">
                <div className="px-4 sm:px-6 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h1 id="main-content" className="text-xl sm:text-2xl font-bold text-slate-800">
                                Property Types
                            </h1>
                            <p className="text-sm text-slate-500 mt-1">Manage property types</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleRefresh}
                                disabled={isFetching}
                                className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                                aria-label="Refresh property types list"
                            >
                                <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                                <span className="hidden sm:inline">Refresh</span>
                            </button>
                            <button
                                onClick={openCreateModal}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors w-full sm:w-auto focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2"
                                aria-label="Create new property type"
                            >
                                <Plus className="w-4 h-4" />
                                Add Property Type
                            </button>
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
                            placeholder="Search property types..."
                            value={searchTerm}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                            aria-label="Search property types by name"
                        />
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6" role="alert">
                        <strong>Error:</strong> {error?.message || 'Failed to load property types'}
                    </div>
                )}

                {/* Loading State */}
                {isLoading ? (
                    <div className="bg-white rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <tbody className="divide-y divide-slate-200">
                                    <TableSkeletonRows columns={4} rows={10} />
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : propertyTypes.length === 0 ? (
                    // Empty State
                    <div className="bg-white rounded-lg p-12 text-center">
                        <Box className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-700 mb-2">No property types found</h3>
                        <p className="text-slate-500 mb-6">
                            {searchTerm
                                ? 'Try adjusting your search terms'
                                : 'Get started by creating your first property type'}
                        </p>
                        {!searchTerm && (
                            <button
                                onClick={openCreateModal}
                                className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
                            >
                                Add Property Type
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Mobile Card View */}
                        <div className="lg:hidden space-y-3">
                            {propertyTypes.map((type: PropertyType) => (
                                <div
                                    key={`mobile-type-${type.id}`}
                                    className="bg-white rounded-lg p-4"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-slate-900 mb-1">
                                                {type.name}
                                            </h3>
                                            <p className="text-sm text-slate-600">
                                                {type.description || 'No description'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                                        <span className="text-xs text-slate-500">
                                            {type.created_at
                                                ? new Date(type.created_at).toLocaleDateString('en-PH', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                })
                                                : '-'
                                            }
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => openEditModal(type.id)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Edit"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(type.id, type.name)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
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
                                                Property Type Name
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                                Description
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
                                        {propertyTypes.map((type: PropertyType) => (
                                            <tr key={`desktop-type-${type.id}`} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-slate-900">{type.name}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-slate-600">
                                                        {type.description || '-'}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-slate-600">
                                                        {type.created_at
                                                            ? new Date(type.created_at).toLocaleDateString('en-PH', {
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
                                                        <button
                                                            onClick={() => openEditModal(type.id)}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title="Edit"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(type.id, type.name)}
                                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
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
                                        disabled={pagination.current_page === 1 || isFetching}
                                        className="flex-1 sm:flex-initial px-4 py-2 text-sm border border-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                                    >
                                        Previous
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage((prev) => Math.min(pagination.last_page, prev + 1))}
                                        disabled={pagination.current_page === pagination.last_page || isFetching}
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
                title={formMode === 'create' ? 'Add Property Type' : 'Edit Property Type'}
                description="Manage property types"
            >
                {formMode === 'edit' && isLoadingType ? (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
                    </div>
                ) : (
                    <form onSubmit={handleFormSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Property Type Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => handleFormChange('name', e.target.value)}
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${formErrors.name ? 'border-red-500' : 'border-slate-300'}`}
                                placeholder="e.g., Computer Equipment"
                                required
                            />
                            {formErrors.name && (
                                <p className="text-sm text-red-600 mt-1">{formErrors.name[0]}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Property Classification <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.property_classification_id}
                                onChange={(e) => handleFormChange('property_classification_id', Number(e.target.value))}
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${formErrors.property_classification_id ? 'border-red-500' : 'border-slate-300'}`}
                                required
                            >
                                <option value={0}>Select classification</option>
                                {classifications.map((classification) => (
                                    <option key={classification.id} value={classification.id}>
                                        {classification.name} ({classification.document_type})
                                    </option>
                                ))}
                            </select>
                            {formErrors.property_classification_id && (
                                <p className="text-sm text-red-600 mt-1">{formErrors.property_classification_id[0]}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                            <textarea
                                value={formData.description || ''}
                                onChange={(e) => handleFormChange('description', e.target.value)}
                                rows={4}
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${formErrors.description ? 'border-red-500' : 'border-slate-300'}`}
                                placeholder="Optional description"
                            />
                            {formErrors.description && (
                                <p className="text-sm text-red-600 mt-1">{formErrors.description[0]}</p>
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
                                {isSaving ? 'Saving...' : formMode === 'create' ? 'Save Property Type' : 'Save Changes'}
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
                title="Delete Property Type"
                description={deleteTarget ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.` : undefined}
                confirmText="Delete"
                cancelText="Cancel"
                onConfirm={handleDeleteConfirm}
                loading={deleteMutation.isPending}
            />
        </div>
    );
}
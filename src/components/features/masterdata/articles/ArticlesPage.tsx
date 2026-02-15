'use client';

import { useEffect, useState } from 'react';
import { useArticles, useArticle, useCreateArticle, useDeleteArticle, useUpdateArticle } from '@/lib/hooks/masterData';
import { Article, ArticleInput } from '@/types/masterData';
import { ApiError } from '@/types/api';
import { FormDialog } from '@/components/ui/FormDialog';
import { Dialog as ConfirmDialog } from '@/components/ui/Dialog';
import { Plus, Search, Edit, Trash2, Package, RefreshCw, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ArticlesPageProps {
    baseRoute: string;
}

export function ArticlesPage({ baseRoute: _baseRoute }: ArticlesPageProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);
    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
    const [activeArticleId, setActiveArticleId] = useState<number | null>(null);
    const [formData, setFormData] = useState<ArticleInput>({
        ArticleName: '',
        Description: '',
        IsActive: true,
    });
    const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});
    const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

    // Use React Query for cached data fetching
    const { data, isLoading, error, refetch } = useArticles({
        search: debouncedSearch || undefined,
        is_active: activeFilter,
        page: currentPage,
        per_page: 15,
        sort_by: 'id',
        sort_order: 'desc',
    });

    const deleteMutation = useDeleteArticle();
    const createMutation = useCreateArticle();
    const updateMutation = useUpdateArticle();
    const { data: activeArticle, isLoading: isLoadingArticle } = useArticle(activeArticleId || 0, {
        enabled: !!activeArticleId,
    });

    // Debounce search input
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setCurrentPage(1);
        }, 300);

        return () => {
            clearTimeout(handler);
        };
    }, [searchTerm]);

    const openCreateModal = () => {
        setFormMode('create');
        setActiveArticleId(null);
        setFormErrors({});
        setFormData({
            ArticleName: '',
            Description: '',
            IsActive: true,
        });
        setFormOpen(true);
    };

    const openEditModal = (article: Article) => {
        setFormMode('edit');
        setActiveArticleId(article.id);
        setFormErrors({});
        setFormOpen(true);
    };

    const handleDelete = (article: Article) => {
        setDeleteTarget({ id: article.id, name: article.name });
    };

    const handleDeleteConfirm = () => {
        if (!deleteTarget) return;
        deleteMutation.mutate(deleteTarget.id, {
            onSuccess: () => setDeleteTarget(null),
        });
    };

    const handlePageChange = (newPage: number) => {
        setCurrentPage(newPage);
    };

    // Pagination calculations
    const totalPages = data ? Math.ceil(data.total / data.per_page) : 1;

    useEffect(() => {
        if (formMode === 'edit' && activeArticle) {
            setFormData({
                ArticleName: activeArticle.name,
                Description: activeArticle.description || '',
                IsActive: activeArticle.is_active,
            });
        }
    }, [activeArticle, formMode]);

    const handleFormChange = (field: keyof ArticleInput, value: string | boolean) => {
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
        if (backendErrors.ArticleName) mappedErrors.ArticleName = backendErrors.ArticleName;
        if (backendErrors.Description) mappedErrors.Description = backendErrors.Description;
        if (backendErrors.IsActive) mappedErrors.IsActive = backendErrors.IsActive;

        setFormErrors(mappedErrors);

        if (Object.keys(mappedErrors).length === 0 && Object.keys(backendErrors).length > 0) {
            toast.error('Please check the form for errors');
        }
    };

    const handleFormSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        setFormErrors({});

        const payload: ArticleInput = {
            ArticleName: formData.ArticleName.trim(),
            Description: formData.Description?.trim() || undefined,
            IsActive: formData.IsActive ?? true,
        };

        if (formMode === 'create') {
            createMutation.mutate(payload, {
                onSuccess: () => setFormOpen(false),
                onError: handleFormError,
            });
            return;
        }

        if (activeArticleId) {
            updateMutation.mutate(
                { id: activeArticleId, data: payload },
                {
                    onSuccess: () => setFormOpen(false),
                    onError: handleFormError,
                }
            );
        }
    };

    const isSaving = createMutation.isPending || updateMutation.isPending;

    if (error) {
        return (
            <div className="flex items-center justify-center p-8 text-red-600">
                <div className="text-center">
                    <p className="mb-4">Failed to load articles</p>
                    <button
                        onClick={() => refetch()}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        <RefreshCw size={16} />
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-app print:hidden">
            <div className="p-4 sm:p-6 lg:p-8 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Articles</h1>
                        <p className="text-sm text-gray-600">Manage article types for government property items</p>
                    </div>
                    <button
                        onClick={openCreateModal}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                        <Plus size={16} />
                        Add Article
                    </button>
                </div>

                {/* Filters and Search */}
                <div className="bg-white rounded-lg p-4">
                    <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
                        {/* Search */}
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search articles..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* Status Filter */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setActiveFilter(undefined)}
                                className={`px-3 py-1 text-sm rounded-full transition-colors ${activeFilter === undefined
                                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                All
                            </button>
                            <button
                                onClick={() => setActiveFilter(true)}
                                className={`px-3 py-1 text-sm rounded-full transition-colors ${activeFilter === true
                                    ? 'bg-green-100 text-green-700 border border-green-200'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                Active
                            </button>
                            <button
                                onClick={() => setActiveFilter(false)}
                                className={`px-3 py-1 text-sm rounded-full transition-colors ${activeFilter === false
                                    ? 'bg-red-100 text-red-700 border border-red-200'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                Inactive
                            </button>
                        </div>
                    </div>
                </div>

                {/* Articles Table */}
                <div className="bg-white rounded-lg overflow-hidden">
                    {isLoading ? (
                        <div className="flex items-center justify-center p-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                            <span className="ml-2 text-gray-600">Loading articles...</span>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Article Name
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Description
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Status
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Created
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white">
                                        {data?.data?.map((article) => (
                                            <tr key={article.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="font-medium text-gray-900">
                                                        {article.name}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-gray-600 max-w-xs truncate">
                                                        {article.description || '-'}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span
                                                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${article.is_active
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-red-100 text-red-800'
                                                            }`}
                                                    >
                                                        {article.is_active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                    {new Date(article.created_at).toLocaleDateString('en-PH', {
                                                        timeZone: 'Asia/Manila',
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric'
                                                    })}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => openEditModal(article)}
                                                            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                                            title="Edit article"
                                                        >
                                                            <Edit size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(article)}
                                                            className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                                                            title="Delete article"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {data && data.total > data.per_page && (
                                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                                    <div className="flex-1 flex justify-between sm:hidden">
                                        <button
                                            onClick={() => handlePageChange(currentPage - 1)}
                                            disabled={currentPage <= 1}
                                            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Previous
                                        </button>
                                        <button
                                            onClick={() => handlePageChange(currentPage + 1)}
                                            disabled={currentPage >= totalPages}
                                            className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Next
                                        </button>
                                    </div>
                                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                                        <div>
                                            <p className="text-sm text-gray-700">
                                                Showing{' '}
                                                <span className="font-medium">
                                                    {(currentPage - 1) * data.per_page + 1}
                                                </span>{' '}
                                                to{' '}
                                                <span className="font-medium">
                                                    {Math.min(currentPage * data.per_page, data.total)}
                                                </span>{' '}
                                                of <span className="font-medium">{data.total}</span> results
                                            </p>
                                        </div>
                                        <div>
                                            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                                    <button
                                                        key={page}
                                                        onClick={() => handlePageChange(page)}
                                                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${page === currentPage
                                                            ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                                                            } ${page === 1 ? 'rounded-l-md' : ''} ${page === totalPages ? 'rounded-r-md' : ''
                                                            }`}
                                                    >
                                                        {page}
                                                    </button>
                                                ))}
                                            </nav>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Empty State */}
                            {data?.data?.length === 0 && (
                                <div className="text-center py-12">
                                    <Package className="mx-auto h-12 w-12 text-gray-400" />
                                    <h3 className="mt-2 text-sm font-medium text-gray-900">No articles found</h3>
                                    <p className="mt-1 text-sm text-gray-500">
                                        {searchTerm || activeFilter !== undefined
                                            ? 'Try adjusting your search or filters.'
                                            : 'Get started by creating your first article.'}
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
            <FormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                title={formMode === 'create' ? 'Add Article' : 'Edit Article'}
                description="Manage article types for government property items"
            >
                {formMode === 'edit' && isLoadingArticle ? (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    </div>
                ) : (
                    <form onSubmit={handleFormSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Article Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.ArticleName}
                                onChange={(e) => handleFormChange('ArticleName', e.target.value)}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${formErrors.ArticleName ? 'border-red-300' : 'border-gray-300'}`}
                                placeholder="Enter article name"
                                required
                            />
                            {formErrors.ArticleName && (
                                <p className="mt-1 text-sm text-red-600">{formErrors.ArticleName[0]}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Description
                            </label>
                            <textarea
                                value={formData.Description || ''}
                                onChange={(e) => handleFormChange('Description', e.target.value)}
                                rows={3}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${formErrors.Description ? 'border-red-300' : 'border-gray-300'}`}
                                placeholder="Enter article description (optional)"
                            />
                            {formErrors.Description && (
                                <p className="mt-1 text-sm text-red-600">{formErrors.Description[0]}</p>
                            )}
                        </div>
                        <div>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={!!formData.IsActive}
                                    onChange={(e) => handleFormChange('IsActive', e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm font-medium text-gray-700">Active</span>
                            </label>
                            <p className="mt-1 text-sm text-gray-500">
                                Inactive articles will not be available for selection in delivery receipts
                            </p>
                        </div>
                        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-gray-200">
                            <button
                                type="button"
                                onClick={() => setFormOpen(false)}
                                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {isSaving ? 'Saving...' : formMode === 'create' ? 'Save Article' : 'Save Changes'}
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
                title="Delete Article"
                description={deleteTarget ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.` : undefined}
                confirmText="Delete"
                cancelText="Cancel"
                onConfirm={handleDeleteConfirm}
                loading={deleteMutation.isPending}
            />
        </div>
    );
}
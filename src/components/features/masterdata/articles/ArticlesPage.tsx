'use client';

import { useEffect, useState } from 'react';
import { useArticles, useArticle, useCreateArticle, useDeleteArticle, useUpdateArticle } from '@/lib/hooks/masterData';
import { useAllPropertyTypes } from '@/lib/hooks/masterData/usePropertyTypes';
import { useAllUnitsOfMeasure } from '@/lib/hooks/masterData/useUnitsOfMeasure';
import { Article, ArticleInput } from '@/types/masterData';
import { ApiError } from '@/types/api';
import { FormDialog } from '@/components/ui/FormDialog';
import { Dialog as ConfirmDialog } from '@/components/ui/Dialog';
import { ArticlePreviewModal } from '@/components/ui/ArticlePreviewModal';
import { TableSkeletonRows } from '@/components/ui/ListSkeletons';
import { Plus, Search, Edit, Trash2, Package, RefreshCw, Save, Loader2, Eye } from 'lucide-react';
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
        PropertyTypeID: 0,
        DefaultUnitOfMeasureID: 2,
        IsActive: true,
    });
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
    const [removeImage, setRemoveImage] = useState(false);
    const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});
    const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

    const [viewingArticle, setViewingArticle] = useState<Article | null>(null);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);

    // Use React Query for cached data fetching
    const { data, isLoading, isFetching, error, refetch } = useArticles({
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

    const { data: propertyTypesData } = useAllPropertyTypes();
    const { data: unitsData } = useAllUnitsOfMeasure();

    const propertyTypes = Array.isArray(propertyTypesData) ? propertyTypesData : [];
    const propertyTypeMap = new Map(propertyTypes.map((pt) => [pt.id, pt.name]));

    type UnitOfMeasureResponse = { id?: number; name?: string; UnitOfMeasureID?: number; UnitName?: string };
    const units = Array.isArray(unitsData)
        ? (unitsData as UnitOfMeasureResponse[])
            .filter(u => u && (u.id ?? u.UnitOfMeasureID))
            .map(u => ({ id: u.id ?? u.UnitOfMeasureID!, name: u.name ?? u.UnitName! }))
        : [];
    const unitMap = new Map(units.map((unit) => [unit.id, unit.name]));

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

    // Allow closing the details modal with Escape key
    useEffect(() => {
        if (!viewingArticle) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setViewingArticle(null);
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [viewingArticle]);

    const openCreateModal = () => {
        setFormMode('create');
        setActiveArticleId(null);
        setFormErrors({});
        setFormData({
            ArticleName: '',
            Description: '',
            PropertyTypeID: 0,
            DefaultUnitOfMeasureID: 2,
            IsActive: true, // new articles are always active by default
        });
        setSelectedImage(null);
        setImagePreviewUrl(null);
        setRemoveImage(false);
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
            const nextFormData: ArticleInput = {
                ArticleName: activeArticle.name,
                Description: activeArticle.description || '',
                PropertyTypeID: activeArticle.property_type_id,
                DefaultUnitOfMeasureID: activeArticle.default_unit_of_measure_id,
                IsActive: activeArticle.is_active,
            };

            const timer = setTimeout(() => {
                setFormData(nextFormData);
                setSelectedImage(null);
                setImagePreviewUrl(activeArticle.image_url || null);
                setRemoveImage(false);
            }, 0);

            return () => clearTimeout(timer);
        }
    }, [activeArticle, formMode]);

    const handleFormChange = (field: keyof ArticleInput, value: string | boolean | number) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        if (formErrors[field as string]) {
            setFormErrors((prev) => {
                const nextErrors = { ...prev };
                delete nextErrors[field as string];
                return nextErrors;
            });
        }
    };

    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] || null;
        setSelectedImage(file);

        if (file) {
            const preview = URL.createObjectURL(file);
            setImagePreviewUrl(preview);
            setRemoveImage(false);
        }

        if (formErrors.ArticleImage) {
            setFormErrors((prev) => {
                const nextErrors = { ...prev };
                delete nextErrors.ArticleImage;
                return nextErrors;
            });
        }
    };

    const handleRemoveImageToggle = (checked: boolean) => {
        setRemoveImage(checked);
        if (checked) {
            setSelectedImage(null);
            setImagePreviewUrl(null);
        } else if (formMode === 'edit') {
            setImagePreviewUrl(activeArticle?.image_url || null);
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
        if (backendErrors.PropertyTypeID) mappedErrors.PropertyTypeID = backendErrors.PropertyTypeID;
        if (backendErrors.DefaultUnitOfMeasureID) mappedErrors.DefaultUnitOfMeasureID = backendErrors.DefaultUnitOfMeasureID;
        if (backendErrors.IsActive) mappedErrors.IsActive = backendErrors.IsActive;
        if (backendErrors.ArticleImage) mappedErrors.ArticleImage = backendErrors.ArticleImage;

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
            PropertyTypeID: formData.PropertyTypeID,
            DefaultUnitOfMeasureID: formData.DefaultUnitOfMeasureID,
            IsActive: formData.IsActive ?? true,
            ArticleImage: selectedImage,
            RemoveImage: removeImage,
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
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <tbody className="bg-white">
                                    <TableSkeletonRows columns={8} rows={10} />
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Image
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Article Name
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Description
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Property Type
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Default Unit
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
                                                    <div className="relative h-10 w-10">
                                                        {article.image_url ? (
                                                            <>
                                                                <img
                                                                    src={article.image_url}
                                                                    alt={article.name}
                                                                    className="h-10 w-10 rounded-md object-cover border border-gray-200"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        setViewImageUrl(article.image_url as string);
                                                                        setIsImageModalOpen(true);
                                                                    }}
                                                                    title="View image"
                                                                    className="absolute inset-0 flex items-center justify-center bg-black/25 text-white opacity-0 hover:opacity-100 rounded-md transition-opacity"
                                                                >
                                                                    <Eye size={14} />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <div className="h-10 w-10 rounded-md bg-gray-100 border border-gray-200" />
                                                        )}
                                                    </div>
                                                </td>
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
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                    {propertyTypeMap.get(article.property_type_id) || 'Unknown'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                    {unitMap.get(article.default_unit_of_measure_id) || 'Unknown'}
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
                                                            onClick={() => setViewingArticle(article)}
                                                            className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                                                            title="View article"
                                                        >
                                                            <Eye size={16} />
                                                        </button>
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
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Article Image
                            </label>
                            <input
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                                onChange={handleImageChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            {imagePreviewUrl && (
                                <div className="mt-3">
                                    <img
                                        src={imagePreviewUrl}
                                        alt="Article preview"
                                        className="h-24 w-24 rounded-lg object-cover border border-gray-200"
                                    />
                                </div>
                            )}
                            {formMode === 'edit' && (activeArticle?.image_url || selectedImage) && (
                                <label className="mt-3 inline-flex items-center gap-2 text-sm text-gray-700">
                                    <input
                                        type="checkbox"
                                        checked={removeImage}
                                        onChange={(e) => handleRemoveImageToggle(e.target.checked)}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    Remove current image
                                </label>
                            )}
                            <p className="mt-1 text-xs text-gray-500">Supported: JPG, PNG, GIF, WEBP. Max size: 2MB.</p>
                            {formErrors.ArticleImage && (
                                <p className="mt-1 text-sm text-red-600">{formErrors.ArticleImage[0]}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Property Type <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.PropertyTypeID}
                                onChange={(e) => handleFormChange('PropertyTypeID', Number(e.target.value))}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${formErrors.PropertyTypeID ? 'border-red-300' : 'border-gray-300'}`}
                            >
                                <option value={0}>Select property type</option>
                                {propertyTypes.map((pt) => (
                                    <option key={pt.id} value={pt.id}>{pt.name}</option>
                                ))}
                            </select>
                            {formErrors.PropertyTypeID && (
                                <p className="mt-1 text-sm text-red-600">{formErrors.PropertyTypeID[0]}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Default Unit of Measure <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.DefaultUnitOfMeasureID}
                                onChange={(e) => handleFormChange('DefaultUnitOfMeasureID', Number(e.target.value))}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${formErrors.DefaultUnitOfMeasureID ? 'border-red-300' : 'border-gray-300'}`}
                            >
                                <option value={0}>Select unit</option>
                                {units.map((unit) => (
                                    <option key={unit.id} value={unit.id}>{unit.name}</option>
                                ))}
                            </select>
                            {formErrors.DefaultUnitOfMeasureID && (
                                <p className="mt-1 text-sm text-red-600">{formErrors.DefaultUnitOfMeasureID[0]}</p>
                            )}
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
            <ArticlePreviewModal
                open={isImageModalOpen && Boolean(viewImageUrl)}
                onClose={() => setIsImageModalOpen(false)}
                imageUrl={viewImageUrl || ''}
                alt="Article"
            />

            {viewingArticle && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    onClick={() => setViewingArticle(null)}
                >
                    <div
                        onClick={(event) => event.stopPropagation()}
                        className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto"
                    >
                        <button
                            type="button"
                            onClick={() => setViewingArticle(null)}
                            className="absolute top-3 right-3 text-gray-500 hover:text-gray-900 bg-white rounded-full p-1 shadow"
                            aria-label="Close article details"
                        >
                            ✕
                        </button>
                        <div className="p-6 space-y-5">
                            <h2 className="text-2xl font-bold text-slate-900">Article Details</h2>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                {viewingArticle.image_url && (
                                    <div className="h-40 w-full overflow-hidden rounded-lg border border-gray-200">
                                        <img
                                            src={viewingArticle.image_url}
                                            alt={viewingArticle.name}
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                )}
                                <div className={`space-y-3 ${viewingArticle.image_url ? 'md:col-span-2' : 'md:col-span-3'}`}>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase tracking-wide">Name</p>
                                        <p className="text-lg font-semibold text-gray-900">{viewingArticle.name}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase tracking-wide">Description</p>
                                        <p className="text-sm text-gray-700">{viewingArticle.description || '-'}</p>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase tracking-wide">Property Type</p>
                                            <p className="text-sm font-medium text-gray-900">{propertyTypeMap.get(viewingArticle.property_type_id) || 'Unknown'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase tracking-wide">Default Unit</p>
                                            <p className="text-sm font-medium text-gray-900">{unitMap.get(viewingArticle.default_unit_of_measure_id) || 'Unknown'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
                                            <p className="text-sm font-medium text-gray-900">{viewingArticle.is_active ? 'Active' : 'Inactive'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase tracking-wide">Created</p>
                                            <p className="text-sm font-medium text-gray-900">{new Date(viewingArticle.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' })}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCategories, deleteCategory, CategoryFilters } from '@/lib/api/categories';
import { Category } from '@/types/masterData';
import { showConfirmDialog } from '@/lib/utils/confirm';
import { Plus, Search, Edit, Trash2, FolderTree } from 'lucide-react';
import { toast } from 'sonner';

export default function CategoriesPage() {
    const router = useRouter();
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [error, setError] = useState<string | null>(null);

    const fetchCategories = async () => {
        try {
            setLoading(true);
            setError(null);
            const filters: CategoryFilters = {
                search: searchTerm || undefined,
                page: currentPage,
                per_page: 15,
                sort_by: 'CategoryID',
                sort_order: 'desc',
            };
            const response = await getCategories(filters);
            setCategories(response.data);
            setTotalPages(response.pagination.last_page);
        } catch (err) {
            setError('Failed to load categories');
            console.error('Error fetching categories:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, [currentPage, searchTerm]);

    const handleDelete = async (id: number, name: string) => {
        showConfirmDialog({
            title: 'Delete Category',
            description: `Are you sure you want to delete "${name}"? This action cannot be undone.`,
            confirmText: 'Delete',
            cancelText: 'Cancel',
            onConfirm: async () => {
                try {
                    await deleteCategory(id);
                    toast.success('Category deleted successfully');
                    fetchCategories();
                } catch (err: unknown) {
                    const error = err as { response?: { data?: { message?: string } } };
                    toast.error(error?.response?.data?.message || 'Failed to delete category');
                }
            },
        });
    };

    const handleSearch = (value: string) => {
        setSearchTerm(value);
        setCurrentPage(1);
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200">
                <div className="px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">Categories</h1>
                            <p className="text-sm text-slate-500 mt-1">Manage property categories</p>
                        </div>
                        <button
                            onClick={() => router.push('/admin/categories/new')}
                            className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Add Category
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="p-6">
                {/* Search Bar */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search categories..."
                            value={searchTerm}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                        />
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {/* Loading State */}
                {loading ? (
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
                        <div className="space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="h-16 bg-slate-100 rounded animate-pulse" />
                            ))}
                        </div>
                    </div>
                ) : categories.length === 0 ? (
                    // Empty State
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
                        <FolderTree className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-700 mb-2">No categories found</h3>
                        <p className="text-slate-500 mb-6">
                            {searchTerm
                                ? 'Try adjusting your search terms'
                                : 'Get started by creating your first category'}
                        </p>
                        {!searchTerm && (
                            <button
                                onClick={() => router.push('/admin/categories/new')}
                                className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
                            >
                                Add Category
                            </button>
                        )}
                    </div>
                ) : (
                    // Table
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        Category Name
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
                                {categories.map((category) => (
                                    <tr key={category.CategoryID} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-900">{category.CategoryName}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-slate-600">
                                                {category.Description || '-'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-slate-600">
                                                {new Date(category.CreatedDate).toLocaleDateString('en-PH', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => router.push(`/admin/categories/${category.CategoryID}`)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(category.CategoryID, category.CategoryName)}
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

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                                <div className="text-sm text-slate-600">
                                    Page {currentPage} of {totalPages}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1 border border-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                                    >
                                        Previous
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1 border border-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Category, CategoryInput } from '@/types/property';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useCategory, useUpdateCategory } from '@/lib/hooks/masterData';

export default function EditCategoryPage() {
    const router = useRouter();
    const params = useParams();
    const id = Number(params.id);

    const [errors, setErrors] = useState<Record<string, string[]>>({});
    const [formData, setFormData] = useState<CategoryInput>({
        name: '',
        description: '',
    });

    const { data: category, isLoading: loading } = useCategory(id);
    const updateCategoryMutation = useUpdateCategory();

    useEffect(() => {
        if (category) {
            setFormData({ // eslint-disable-line react-hooks/set-state-in-effect
                name: category.name,
                description: category.description || '',
            });
        }
    }, [category]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});

        updateCategoryMutation.mutate(
            { id, data: formData },
            {
                onSuccess: () => {
                    toast.success('Category updated successfully');
                    router.push('/admin/masterdata/categories');
                },
                onError: (error: any) => {
                    if (error?.response?.data?.errors) {
                        const backendErrors = error.response.data.errors;
                        const mappedErrors: Record<string, string[]> = {};

                        if (backendErrors.name) mappedErrors.name = backendErrors.name;
                        if (backendErrors.description) mappedErrors.description = backendErrors.description;

                        // Map backend PascalCase to frontend camelCase
                        if (backendErrors.CategoryName) mappedErrors.name = backendErrors.CategoryName;
                        if (backendErrors.Description) mappedErrors.description = backendErrors.Description;

                        setErrors(mappedErrors);

                        if (Object.keys(mappedErrors).length === 0 && Object.keys(backendErrors).length > 0) {
                            toast.error('Please check the form for errors');
                        }
                    } else {
                        toast.error(error?.message || 'Failed to update category');
                    }
                },
            }
        );
    };

    const handleChange = (field: keyof CategoryInput, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        // Clear error for this field
        if (errors[field]) {
            setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-600">Loading category...</p>
                </div>
            </div>
        );
    }

    if (!category) {
        return null;
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200">
                <div className="px-6 py-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-slate-600" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">Edit Category</h1>
                            <p className="text-sm text-slate-500 mt-1">Update category information</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Form */}
            <div className="p-6 max-w-2xl">
                <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                    {/* Category Name */}
                    <div className="mb-6">
                        <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
                            Category Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            id="name"
                            value={formData.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${errors.name ? 'border-red-500' : 'border-slate-300'
                                }`}
                            required
                        />
                        {errors.name && (
                            <p className="mt-1 text-sm text-red-600">{errors.name[0]}</p>
                        )}
                    </div>

                    {/* Description */}
                    <div className="mb-6">
                        <label htmlFor="Description" className="block text-sm font-medium text-slate-700 mb-2">
                            Description
                        </label>
                        <textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => handleChange('description', e.target.value)}
                            rows={4}
                            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${errors.description ? 'border-red-500' : 'border-slate-300'
                                }`}
                        />
                        {errors.description && (
                            <p className="mt-1 text-sm text-red-600">{errors.description[0]}</p>
                        )}
                    </div>

                    {/* Metadata */}
                    <div className="mb-6 p-4 bg-slate-50 rounded-lg">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-slate-600">Created:</span>
                                <span className="ml-2 text-slate-800">
                                    {new Date(category.created_at).toLocaleString('en-PH')}
                                </span>
                            </div>
                            {category.updated_at && (
                                <div>
                                    <span className="text-slate-600">Last Updated:</span>
                                    <span className="ml-2 text-slate-800">
                                        {new Date(category.updated_at).toLocaleString('en-PH')}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={updateCategoryMutation.isPending}
                            className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Save className="w-4 h-4" />
                            {updateCategoryMutation.isPending ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

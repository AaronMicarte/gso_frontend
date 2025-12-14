'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CategoryInput } from '@/types/property';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateCategory } from '@/lib/hooks/masterData';

export default function NewCategoryPage() {
    const router = useRouter();
    const [errors, setErrors] = useState<Record<string, string[]>>({});
    const [formData, setFormData] = useState<CategoryInput>({
        name: '',
        description: '',
    });

    const createCategoryMutation = useCreateCategory();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});

        createCategoryMutation.mutate(formData, {
            onSuccess: () => {
                // Toast is handled by the hook
                setTimeout(() => router.push('/admin/masterdata/categories'), 100);
            },
            onError: (error: unknown) => {
                const err = error as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } };
                if (err.response?.data?.errors) {
                    const backendErrors = err.response.data.errors;
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
                    toast.error(err.response?.data?.message || (error as Error).message || 'Failed to create category');
                }
            },
        });
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
                            <h1 className="text-2xl font-bold text-slate-800">Add New Category</h1>
                            <p className="text-sm text-slate-500 mt-1">Create a new property category</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Form */}
            <div className="p-6 max-w-2xl">
                <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                    {/* Category Name */}
                    <div className="mb-6">
                        <label htmlFor="CategoryName" className="block text-sm font-medium text-slate-700 mb-2">
                            Category Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            id="name"
                            value={formData.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${errors.name ? 'border-red-500' : 'border-slate-300'
                                }`}
                            placeholder="e.g., Information Technology"
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
                            placeholder="Enter category description (optional)"
                        />
                        {errors.description && (
                            <p className="mt-1 text-sm text-red-600">{errors.description[0]}</p>
                        )}
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
                            disabled={createCategoryMutation.isPending}
                            className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Save className="w-4 h-4" />
                            {createCategoryMutation.isPending ? 'Saving...' : 'Save Category'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

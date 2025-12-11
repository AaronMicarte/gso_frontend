'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateClassification, useAllCategories } from '@/lib/hooks/masterData';
import { ClassificationInput } from '@/types/masterData';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function NewClassificationPage() {
    const router = useRouter();
    const createMutation = useCreateClassification();
    const { data: categories, isLoading: categoriesLoading } = useAllCategories();

    const [formData, setFormData] = useState<ClassificationInput>({
        name: '',
        category_id: 0,
        description: '',
    });

    const [errors, setErrors] = useState<Record<string, string[]>>({});

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});

        createMutation.mutate(formData, {
            onSuccess: () => {
                toast.success('Classification created successfully');
                router.push('/admin/masterdata/classifications');
            },
            onError: (error: any) => {
                if (error?.response?.data?.errors) {
                    const backendErrors = error.response.data.errors;
                    const mappedErrors: Record<string, string[]> = {};
                    if (backendErrors.ClassificationName) mappedErrors.name = backendErrors.ClassificationName;
                    if (backendErrors.CategoryID) mappedErrors.category_id = backendErrors.CategoryID;
                    if (backendErrors.CategoryId) mappedErrors.category_id = backendErrors.CategoryId;
                    if (backendErrors.Description) mappedErrors.description = backendErrors.Description;

                    if (Object.keys(mappedErrors).length === 0) {
                        setErrors(backendErrors);
                    } else {
                        setErrors(mappedErrors);
                    }
                } else {
                    toast.error('Failed to create classification');
                }
            },
        });
    };

    const handleChange = (field: keyof ClassificationInput, value: string | number) => {
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
                            <h1 className="text-2xl font-bold text-slate-800">Add New Classification</h1>
                            <p className="text-sm text-slate-500 mt-1">Create a new property classification</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Form */}
            <div className="p-6 max-w-2xl">
                <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                    {/* Classification Name */}
                    <div className="mb-6">
                        <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
                            Classification Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            id="name"
                            value={formData.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${errors.name ? 'border-red-500' : 'border-slate-300'
                                }`}
                            placeholder="e.g., Office Equipment"
                            required
                        />
                        {errors.name && (
                            <p className="mt-1 text-sm text-red-600">{errors.name[0]}</p>
                        )}
                    </div>

                    {/* Category */}
                    <div className="mb-6">
                        <label htmlFor="category_id" className="block text-sm font-medium text-slate-700 mb-2">
                            Category <span className="text-red-500">*</span>
                        </label>
                        <select
                            id="category_id"
                            value={formData.category_id || ''}
                            onChange={(e) => handleChange('category_id', parseInt(e.target.value))}
                            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${errors.category_id ? 'border-red-500' : 'border-slate-300'
                                }`}
                            required
                            disabled={categoriesLoading}
                        >
                            <option value="">Select a category</option>
                            {categories?.map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.name}
                                </option>
                            ))}
                        </select>
                        {errors.category_id && (
                            <p className="mt-1 text-sm text-red-600">{errors.category_id[0]}</p>
                        )}
                    </div>

                    {/* Description */}
                    <div className="mb-6">
                        <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-2">
                            Description
                        </label>
                        <textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => handleChange('description', e.target.value)}
                            rows={4}
                            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${errors.description ? 'border-red-500' : 'border-slate-300'
                                }`}
                            placeholder="Enter description..."
                        />
                        {errors.description && (
                            <p className="mt-1 text-sm text-red-600">{errors.description[0]}</p>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-4 py-2 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={createMutation.isPending}
                            className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            {createMutation.isPending ? 'Saving...' : 'Save Classification'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

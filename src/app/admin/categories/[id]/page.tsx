'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getCategory, updateCategory } from '@/lib/api/categories';
import { Category, CategoryInput } from '@/types/masterData';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function EditCategoryPage() {
    const router = useRouter();
    const params = useParams();
    const id = Number(params.id);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string[]>>({});
    const [category, setCategory] = useState<Category | null>(null);
    const [formData, setFormData] = useState<CategoryInput>({
        CategoryName: '',
        Description: '',
    });

    useEffect(() => {
        const fetchCategory = async () => {
            try {
                const data = await getCategory(id);
                setCategory(data);
                setFormData({
                    CategoryName: data.CategoryName,
                    Description: data.Description || '',
                });
            } catch (err) {
                toast.error('Failed to load category');
                router.push('/admin/categories');
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchCategory();
        }
    }, [id, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setErrors({});

        try {
            await updateCategory(id, formData);
            toast.success('Category updated successfully');
            router.push('/admin/categories');
        } catch (err: unknown) {
            const error = err as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } };
            if (error?.response?.data?.errors) {
                setErrors(error.response.data.errors);
            } else {
                toast.error(error?.response?.data?.message || 'Failed to update category');
            }
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (field: keyof CategoryInput, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
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
                        <label htmlFor="CategoryName" className="block text-sm font-medium text-slate-700 mb-2">
                            Category Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            id="CategoryName"
                            value={formData.CategoryName}
                            onChange={(e) => handleChange('CategoryName', e.target.value)}
                            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${errors.CategoryName ? 'border-red-500' : 'border-slate-300'
                                }`}
                            required
                        />
                        {errors.CategoryName && (
                            <p className="mt-1 text-sm text-red-600">{errors.CategoryName[0]}</p>
                        )}
                    </div>

                    {/* Description */}
                    <div className="mb-6">
                        <label htmlFor="Description" className="block text-sm font-medium text-slate-700 mb-2">
                            Description
                        </label>
                        <textarea
                            id="Description"
                            value={formData.Description}
                            onChange={(e) => handleChange('Description', e.target.value)}
                            rows={4}
                            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${errors.Description ? 'border-red-500' : 'border-slate-300'
                                }`}
                        />
                        {errors.Description && (
                            <p className="mt-1 text-sm text-red-600">{errors.Description[0]}</p>
                        )}
                    </div>

                    {/* Metadata */}
                    <div className="mb-6 p-4 bg-slate-50 rounded-lg">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-slate-600">Created:</span>
                                <span className="ml-2 text-slate-800">
                                    {new Date(category.CreatedDate).toLocaleString('en-PH')}
                                </span>
                            </div>
                            {category.UpdatedDate && (
                                <div>
                                    <span className="text-slate-600">Last Updated:</span>
                                    <span className="ml-2 text-slate-800">
                                        {new Date(category.UpdatedDate).toLocaleString('en-PH')}
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
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

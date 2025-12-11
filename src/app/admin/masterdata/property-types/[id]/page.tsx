'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { usePropertyType, useUpdatePropertyType, useAllCategories, useAllClassifications, useAllPropertyClassifications } from '@/lib/hooks/masterData';
import { PropertyTypeInput } from '@/types/masterData';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function EditPropertyTypePage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { id } = use(params);
    const typeId = parseInt(id);

    const { data: propertyType, isLoading: isDataLoading, error } = usePropertyType(typeId);
    const updateMutation = useUpdatePropertyType();
    const { data: categories, isLoading: categoriesLoading } = useAllCategories();
    const { data: classifications, isLoading: classificationsLoading } = useAllClassifications();
    const { data: propertyClassifications, isLoading: propertyClassificationsLoading } = useAllPropertyClassifications();

    const [formData, setFormData] = useState<PropertyTypeInput>({
        name: '',
        category_id: 0,
        classification_id: 0,
        property_classification_id: 0,
        description: '',
    });

    const [errors, setErrors] = useState<Record<string, string[]>>({});

    useEffect(() => {
        if (propertyType) {
            setFormData({
                name: propertyType.name,
                category_id: propertyType.category_id,
                classification_id: propertyType.classification_id,
                property_classification_id: propertyType.property_classification_id,
                description: propertyType.description || '',
            });
        }
    }, [propertyType]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});

        updateMutation.mutate(
            { id: typeId, data: formData },
            {
                onSuccess: () => {
                    toast.success('Property type updated successfully');
                    router.push('/admin/masterdata/property-types');
                },
                onError: (error: any) => {
                    if (error?.response?.data?.errors) {
                        const backendErrors = error.response.data.errors;
                        const mappedErrors: Record<string, string[]> = {};

                        if (backendErrors.name) mappedErrors.name = backendErrors.name;
                        if (backendErrors.description) mappedErrors.description = backendErrors.description;
                        if (backendErrors.category_id) mappedErrors.category_id = backendErrors.category_id;
                        if (backendErrors.classification_id) mappedErrors.classification_id = backendErrors.classification_id;
                        if (backendErrors.property_classification_id) mappedErrors.property_classification_id = backendErrors.property_classification_id;

                        // Map backend PascalCase to frontend camelCase
                        if (backendErrors.PropertyName) mappedErrors.name = backendErrors.PropertyName;
                        if (backendErrors.Description) mappedErrors.description = backendErrors.Description;
                        if (backendErrors.CategoryID) mappedErrors.category_id = backendErrors.CategoryID;
                        if (backendErrors.ClassificationID) mappedErrors.classification_id = backendErrors.ClassificationID;
                        if (backendErrors.PropertyClassificationID) mappedErrors.property_classification_id = backendErrors.PropertyClassificationID;

                        setErrors(mappedErrors);

                        if (Object.keys(mappedErrors).length === 0 && Object.keys(backendErrors).length > 0) {
                            toast.error('Please check the form for errors');
                        }
                    } else {
                        toast.error('Failed to update property type');
                    }
                },
            }
        );
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: name.includes('_id') ? Number(value) : value,
        }));
        // Clear error when user types
        if (errors[name]) {
            setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };

    const isLoading = isDataLoading || categoriesLoading || classificationsLoading || propertyClassificationsLoading;

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
                <div className="bg-red-50 text-red-800 p-4 rounded-lg max-w-md text-center">
                    <h3 className="font-bold mb-2">Error Loading Property Type</h3>
                    <p>{error.message || 'Failed to load property type details'}</p>
                    <button
                        onClick={() => router.back()}
                        className="mt-4 px-4 py-2 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="px-4 sm:px-6 py-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                            aria-label="Go back"
                        >
                            <ArrowLeft className="w-5 h-5 text-slate-600" />
                        </button>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
                                Edit Property Type
                            </h1>
                            <p className="text-sm text-slate-500 mt-1">Update property type details</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
                <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-slate-200">
                    <div className="p-6 space-y-6">
                        {/* Name Field */}
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
                                Property Type Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                className={`w-full px-4 py-2 rounded-lg border ${errors.name ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:ring-[var(--primary)]'
                                    } focus:outline-none focus:ring-2 transition-all`}
                                placeholder="Enter property type name"
                                required
                            />
                            {errors.name && (
                                <p className="mt-1 text-sm text-red-500">{errors.name[0]}</p>
                            )}
                        </div>

                        {/* Category Field */}
                        <div>
                            <label htmlFor="category_id" className="block text-sm font-medium text-slate-700 mb-1">
                                Category <span className="text-red-500">*</span>
                            </label>
                            <select
                                id="category_id"
                                name="category_id"
                                value={formData.category_id}
                                onChange={handleChange}
                                className={`w-full px-4 py-2 rounded-lg border ${errors.category_id ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:ring-[var(--primary)]'
                                    } focus:outline-none focus:ring-2 transition-all`}
                                required
                            >
                                <option value={0}>Select a category</option>
                                {categories?.map((category: any) => (
                                    <option key={category.id} value={category.id}>
                                        {category.name}
                                    </option>
                                ))}
                            </select>
                            {errors.category_id && (
                                <p className="mt-1 text-sm text-red-500">{errors.category_id[0]}</p>
                            )}
                        </div>

                        {/* Classification Field */}
                        <div>
                            <label htmlFor="classification_id" className="block text-sm font-medium text-slate-700 mb-1">
                                Classification <span className="text-red-500">*</span>
                            </label>
                            <select
                                id="classification_id"
                                name="classification_id"
                                value={formData.classification_id}
                                onChange={handleChange}
                                className={`w-full px-4 py-2 rounded-lg border ${errors.classification_id ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:ring-[var(--primary)]'
                                    } focus:outline-none focus:ring-2 transition-all`}
                                required
                            >
                                <option value={0}>Select a classification</option>
                                {classifications?.map((classification: any) => (
                                    <option key={classification.id} value={classification.id}>
                                        {classification.name}
                                    </option>
                                ))}
                            </select>
                            {errors.classification_id && (
                                <p className="mt-1 text-sm text-red-500">{errors.classification_id[0]}</p>
                            )}
                        </div>

                        {/* Property Classification Field */}
                        <div>
                            <label htmlFor="property_classification_id" className="block text-sm font-medium text-slate-700 mb-1">
                                Property Classification <span className="text-red-500">*</span>
                            </label>
                            <select
                                id="property_classification_id"
                                name="property_classification_id"
                                value={formData.property_classification_id}
                                onChange={handleChange}
                                className={`w-full px-4 py-2 rounded-lg border ${errors.property_classification_id ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:ring-[var(--primary)]'
                                    } focus:outline-none focus:ring-2 transition-all`}
                                required
                            >
                                <option value={0}>Select a property classification</option>
                                {propertyClassifications?.map((pc: any) => (
                                    <option key={pc.id} value={pc.id}>
                                        {pc.name}
                                    </option>
                                ))}
                            </select>
                            {errors.property_classification_id && (
                                <p className="mt-1 text-sm text-red-500">{errors.property_classification_id[0]}</p>
                            )}
                        </div>

                        {/* Description Field */}
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-1">
                                Description
                            </label>
                            <textarea
                                id="description"
                                name="description"
                                value={formData.description || ''}
                                onChange={handleChange}
                                rows={4}
                                className={`w-full px-4 py-2 rounded-lg border ${errors.description ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:ring-[var(--primary)]'
                                    } focus:outline-none focus:ring-2 transition-all resize-none`}
                                placeholder="Enter description (optional)"
                            />
                            {errors.description && (
                                <p className="mt-1 text-sm text-red-500">{errors.description[0]}</p>
                            )}
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 rounded-b-lg">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={updateMutation.isPending}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[var(--primary)] rounded-lg hover:bg-[var(--primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {updateMutation.isPending ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

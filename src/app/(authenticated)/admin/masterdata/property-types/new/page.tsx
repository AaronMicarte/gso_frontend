'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreatePropertyType, useAllPropertyClassifications } from '@/lib/hooks/masterData';
import { PropertyTypeInput, PropertyClassification } from '@/types/masterData';
import { ApiError } from '@/types/api';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function NewPropertyTypePage() {
    const router = useRouter();
    const createMutation = useCreatePropertyType();
    const { data: propertyClassifications, isLoading: propertyClassificationsLoading } = useAllPropertyClassifications();

    const [formData, setFormData] = useState<PropertyTypeInput>({
        name: '',
        property_classification_id: 0,
        description: '',
    });

    const [errors, setErrors] = useState<Record<string, string[]>>({});

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});

        createMutation.mutate(formData, {
            onSuccess: () => {
                // Toast is handled by the hook
                setTimeout(() => router.push('/admin/masterdata/property-types'), 100);
            },
            onError: (error: Error) => {
                const apiError = error as ApiError;
                if (apiError?.response?.data?.errors) {
                    const backendErrors = apiError.response.data.errors;
                    const mappedErrors: Record<string, string[]> = {};

                    if (backendErrors.name) mappedErrors.name = backendErrors.name;
                    if (backendErrors.description) mappedErrors.description = backendErrors.description;
                    if (backendErrors.property_classification_id) mappedErrors.property_classification_id = backendErrors.property_classification_id;

                    // Map backend PascalCase to frontend camelCase
                    if (backendErrors.PropertyName) mappedErrors.name = backendErrors.PropertyName;
                    if (backendErrors.Description) mappedErrors.description = backendErrors.Description;
                    if (backendErrors.PropertyClassificationID) mappedErrors.property_classification_id = backendErrors.PropertyClassificationID;

                    setErrors(mappedErrors);

                    if (Object.keys(mappedErrors).length === 0 && Object.keys(backendErrors).length > 0) {
                        toast.error('Please check the form for errors');
                    }
                } else {
                    toast.error(apiError?.response?.data?.message || error.message || 'Failed to create property type');
                }
            },
        });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const parsedValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
        setFormData((prev) => ({
            ...prev,
            [name]: name.includes('_id') ? Number(parsedValue) : parsedValue,
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

    const isLoading = propertyClassificationsLoading;

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
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
                                New Property Type
                            </h1>
                            <p className="text-sm text-slate-500 mt-1">Create a new property type</p>
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
                                {propertyClassifications?.map((pc: PropertyClassification) => (
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
                            disabled={createMutation.isPending}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[var(--primary)] rounded-lg hover:bg-[var(--primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {createMutation.isPending ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Create Property Type
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

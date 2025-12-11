'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PropertyClassificationInput } from '@/types/masterData';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useCreatePropertyClassification } from '@/lib/hooks/masterData';

export default function NewPropertyClassificationPage() {
    const router = useRouter();
    const [errors, setErrors] = useState<Record<string, string[]>>({});
    const [formData, setFormData] = useState<PropertyClassificationInput>({
        name: '',
        description: '',
        document_type: 'ICS',
    });

    const createMutation = useCreatePropertyClassification();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});

        createMutation.mutate(formData, {
            onSuccess: () => {
                toast.success('Property classification created successfully');
                router.push('/admin/masterdata/property-classifications');
            },
            onError: (error: any) => {
                if (error?.response?.data?.errors) {
                    const backendErrors = error.response.data.errors;
                    const mappedErrors: Record<string, string[]> = {};

                    if (backendErrors.name) mappedErrors.name = backendErrors.name;
                    if (backendErrors.description) mappedErrors.description = backendErrors.description;
                    if (backendErrors.document_type) mappedErrors.document_type = backendErrors.document_type;

                    // Map backend PascalCase to frontend camelCase
                    if (backendErrors.ClassificationName) mappedErrors.name = backendErrors.ClassificationName;
                    if (backendErrors.Description) mappedErrors.description = backendErrors.Description;
                    if (backendErrors.DocumentType) mappedErrors.document_type = backendErrors.DocumentType;

                    setErrors(mappedErrors);

                    if (Object.keys(mappedErrors).length === 0 && Object.keys(backendErrors).length > 0) {
                        toast.error('Please check the form for errors');
                    }
                } else {
                    toast.error(error?.message || 'Failed to create property classification');
                }
            },
        });
    };

    const handleChange = (field: keyof PropertyClassificationInput, value: string) => {
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
                            <h1 className="text-2xl font-bold text-slate-800">Add New Property Classification</h1>
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

                    {/* Document Type */}
                    <div className="mb-6">
                        <label htmlFor="document_type" className="block text-sm font-medium text-slate-700 mb-2">
                            Document Type <span className="text-red-500">*</span>
                        </label>
                        <select
                            id="document_type"
                            value={formData.document_type}
                            onChange={(e) => handleChange('document_type', e.target.value as 'ICS' | 'PAR')}
                            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${errors.document_type ? 'border-red-500' : 'border-slate-300'
                                }`}
                            required
                        >
                            <option value="ICS">ICS (Inventory Custodian Slip)</option>
                            <option value="PAR">PAR (Property Acknowledgement Receipt)</option>
                        </select>
                        {errors.document_type && (
                            <p className="mt-1 text-sm text-red-600">{errors.document_type[0]}</p>
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

'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { PropertyClassificationInput } from '@/types/masterData';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import { usePropertyClassification, useUpdatePropertyClassification } from '@/lib/hooks/masterData';

export default function EditPropertyClassificationPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const resolvedParams = use(params);
    const id = parseInt(resolvedParams.id);

    const [errors, setErrors] = useState<Record<string, string[]>>({});
    const [formData, setFormData] = useState<PropertyClassificationInput>({
        name: '',
        description: '',
        document_type: 'ICS',
    });

    const { data: classification, isLoading: loading } = usePropertyClassification(id);
    const updateMutation = useUpdatePropertyClassification();

    useEffect(() => {
        if (classification) {
            setFormData({
                name: classification.name,
                description: classification.description || '',
                document_type: classification.document_type,
            });
        }
    }, [classification]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});

        updateMutation.mutate(
            { id, data: formData },
            {
                onSuccess: () => {
                    toast.success('Property classification updated successfully');
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
                        toast.error(error?.message || 'Failed to update property classification');
                    }
                },
            }
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
            </div>
        );
    }

    if (!classification) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">Property Classification Not Found</h1>
                    <p className="text-slate-600 mb-4">The property classification you're looking for doesn't exist.</p>
                    <button
                        onClick={() => router.push('/admin/masterdata/property-classifications')}
                        className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)]"
                    >
                        Back to Property Classifications
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
                                Edit Property Classification
                            </h1>
                            <p className="text-sm text-slate-500">Update property classification details</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
                <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-slate-200">
                    <div className="p-6 space-y-6">
                        {/* Classification Name */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Classification Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-colors ${errors.name ? 'border-red-300 focus:ring-red-200' : 'border-slate-300'
                                    }`}
                                placeholder="e.g., Office Equipment"
                            />
                            {errors.name && (
                                <p className="mt-1 text-sm text-red-600">{errors.name[0]}</p>
                            )}
                        </div>

                        {/* Document Type */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Document Type <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.document_type}
                                onChange={(e) => setFormData({ ...formData, document_type: e.target.value as 'ICS' | 'PAR' })}
                                required
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-colors ${errors.document_type ? 'border-red-300 focus:ring-red-200' : 'border-slate-300'
                                    }`}
                            >
                                <option value="ICS">ICS (Inventory Custodian Slip)</option>
                                <option value="PAR">PAR (Property Acknowledgement Receipt)</option>
                            </select>
                            {errors.document_type && (
                                <p className="mt-1 text-sm text-red-600">{errors.document_type[0]}</p>
                            )}
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Description
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={4}
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-colors ${errors.description ? 'border-red-300 focus:ring-red-200' : 'border-slate-300'
                                    }`}
                                placeholder="Optional description..."
                            />
                            {errors.description && (
                                <p className="mt-1 text-sm text-red-600">{errors.description[0]}</p>
                            )}
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 rounded-b-lg">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-white transition-colors font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={updateMutation.isPending}
                            className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 font-medium"
                        >
                            {updateMutation.isPending ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
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

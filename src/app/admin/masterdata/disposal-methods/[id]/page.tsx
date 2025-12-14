'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { DisposalMethodInput } from '@/types/masterData';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useDisposalMethod, useUpdateDisposalMethod } from '@/lib/hooks/masterData';

export default function EditDisposalMethodPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const resolvedParams = use(params);
    const id = parseInt(resolvedParams.id);

    const [errors, setErrors] = useState<Record<string, string[]>>({});
    const [formData, setFormData] = useState<DisposalMethodInput>({
        name: '',
        description: '',
    });

    const { data: disposalMethod, isLoading: loading } = useDisposalMethod(id);
    const updateDisposalMethodMutation = useUpdateDisposalMethod();

    useEffect(() => {
        if (disposalMethod) {
            setFormData({ // eslint-disable-line react-hooks/set-state-in-effect
                name: disposalMethod.name || '',
                description: disposalMethod.description || '',
            });
        }
    }, [disposalMethod]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});

        updateDisposalMethodMutation.mutate(
            { id, data: formData },
            {
                onSuccess: () => {
                    toast.success('Disposal method updated successfully');
                    router.push('/admin/masterdata/disposal-methods');
                },
                onError: (error: any) => {
                    if (error?.response?.data?.errors) {
                        const backendErrors = error.response.data.errors;
                        const mappedErrors: Record<string, string[]> = {};
                        // Map backend errors to frontend fields if necessary
                        if (backendErrors.MethodName) mappedErrors.name = backendErrors.MethodName;
                        if (backendErrors.Description) mappedErrors.description = backendErrors.Description;

                        // Fallback to direct mapping if specific keys aren't found
                        if (Object.keys(mappedErrors).length === 0) {
                            setErrors(backendErrors);
                        } else {
                            setErrors(mappedErrors);
                        }
                    } else {
                        toast.error('Failed to update disposal method');
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

    if (!disposalMethod) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">Disposal Method Not Found</h1>
                    <p className="text-slate-600 mb-4">The disposal method you're looking for doesn't exist.</p>
                    <button
                        onClick={() => router.push('/admin/masterdata/disposal-methods')}
                        className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)]"
                    >
                        Back to Disposal Methods
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
                                Edit Disposal Method
                            </h1>
                            <p className="text-sm text-slate-500">Update disposal method details</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
                <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-slate-200">
                    <div className="p-6 space-y-6">
                        {/* Disposal Method Name */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Disposal Method Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-colors ${errors.name ? 'border-red-300 focus:ring-red-200' : 'border-slate-300'
                                    }`}
                                placeholder="e.g., Public Auction"
                            />
                            {errors.name && (
                                <p className="mt-1 text-sm text-red-600">{errors.name[0]}</p>
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
                            disabled={updateDisposalMethodMutation.isPending}
                            className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 font-medium"
                        >
                            {updateDisposalMethodMutation.isPending ? (
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
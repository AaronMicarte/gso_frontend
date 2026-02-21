'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDisposalMethod, useCreateDisposalMethod, useUpdateDisposalMethod } from '@/lib/hooks/masterData';
import { DisposalMethodInput } from '@/types/masterData';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface DisposalMethodFormPageProps {
    baseRoute: string;
    disposalMethodId?: number;
}

export function DisposalMethodFormPage({ baseRoute, disposalMethodId }: DisposalMethodFormPageProps) {
    const router = useRouter();
    const isEditing = !!disposalMethodId;

    const { data: disposalMethod, isLoading: disposalMethodLoading } = useDisposalMethod(disposalMethodId || null);
    const createMutation = useCreateDisposalMethod();
    const updateMutation = useUpdateDisposalMethod();

    const [formData, setFormData] = useState<DisposalMethodInput>({
        name: '',
        description: '',
    });

    const [errors, setErrors] = useState<Record<string, string[]>>({});

    useEffect(() => {
        if (disposalMethod && isEditing) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setFormData({
                name: disposalMethod.name,
                description: disposalMethod.description || '',
            });
        }
    }, [disposalMethod, isEditing]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});

        const mutation = isEditing ? updateMutation : createMutation;
        const payload = isEditing ? { id: disposalMethodId!, data: formData } : formData;

        // @ts-expect-error - Type mismatch between create and update payloads
        mutation.mutate(payload, {
            onSuccess: () => {
                toast.success(`Disposal method ${isEditing ? 'updated' : 'created'} successfully`);
                router.push(`${baseRoute}/masterdata/disposal-methods`);
            },
            onError: (error: unknown) => {
                const err = error as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } };
                if (err.response?.data?.errors) {
                    const backendErrors = err.response.data.errors;
                    const mappedErrors: Record<string, string[]> = {};

                    if (backendErrors.name) mappedErrors.name = backendErrors.name;
                    if (backendErrors.description) mappedErrors.description = backendErrors.description;
                    if (backendErrors.MethodName) mappedErrors.name = backendErrors.MethodName;
                    if (backendErrors.Description) mappedErrors.description = backendErrors.Description;

                    setErrors(Object.keys(mappedErrors).length > 0 ? mappedErrors : backendErrors);
                } else {
                    toast.error(err.response?.data?.message || (error as Error).message || `Failed to ${isEditing ? 'update' : 'create'} disposal method`);
                }
            },
        });
    };

    const handleChange = (field: keyof DisposalMethodInput, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const isLoading = isEditing && disposalMethodLoading;
    const isSaving = createMutation.isPending || updateMutation.isPending;

    if (isEditing && !disposalMethod && !isLoading) {
        return (
            <div className="min-h-screen bg-app print:hidden flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">Disposal Method Not Found</h1>
                    <p className="text-slate-600 mb-4">The disposal method you&apos;re looking for doesn&apos;t exist.</p>
                    <button
                        onClick={() => router.push(`${baseRoute}/masterdata/disposal-methods`)}
                        className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)]"
                    >
                        Back to Disposal Methods
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-app print:hidden">
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
                            <h1 className="text-2xl font-bold text-slate-800">
                                {isEditing ? 'Edit Disposal Method' : 'Add New Disposal Method'}
                            </h1>
                            <p className="text-sm text-slate-500 mt-1">
                                {isEditing ? 'Update disposal method details' : 'Create a new property disposal method'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Form */}
            <div className="p-6 max-w-2xl">
                <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                    {/* Disposal Method Name */}
                    <div className="mb-6">
                        <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
                            Disposal Method Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            id="name"
                            value={formData.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${errors.name ? 'border-red-500' : 'border-slate-300'
                                }`}
                            placeholder="e.g., Public Auction"
                            required
                        />
                        {errors.name && (
                            <p className="text-red-500 text-sm mt-1">{errors.name[0]}</p>
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
                            placeholder="Optional description..."
                        />
                        {errors.description && (
                            <p className="text-red-500 text-sm mt-1">{errors.description[0]}</p>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    {isEditing ? 'Save Changes' : 'Create Disposal Method'}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
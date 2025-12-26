'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUnitOfMeasure, useCreateUnitOfMeasure, useUpdateUnitOfMeasure } from '@/lib/hooks/masterData';
import { UnitOfMeasureInput } from '@/types/masterData';
import { toast } from 'sonner';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

interface UnitOfMeasureFormPageProps {
    baseRoute: string;
    unitId?: number;
}

export function UnitOfMeasureFormPage({ baseRoute, unitId }: UnitOfMeasureFormPageProps) {
    const router = useRouter();
    const isEditing = !!unitId;

    const { data: unit, isLoading: unitLoading } = useUnitOfMeasure(unitId || null);
    const createMutation = useCreateUnitOfMeasure();
    const updateMutation = useUpdateUnitOfMeasure();

    const [formData, setFormData] = useState<UnitOfMeasureInput>({
        name: '',
        description: '',
    });

    const [errors, setErrors] = useState<Record<string, string[]>>({});

    useEffect(() => {
        if (unit && isEditing) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setFormData({
                name: unit.name,
                description: unit.description || '',
            });
        }
    }, [unit, isEditing]);  

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});

        const mutation = isEditing ? updateMutation : createMutation;
        const payload = isEditing ? { id: unitId!, data: formData } : formData;

        // @ts-expect-error - Type mismatch between create and update payloads
        mutation.mutate(payload, {
            onSuccess: () => {
                toast.success(`Unit of measure ${isEditing ? 'updated' : 'created'} successfully`);
                router.push(`${baseRoute}/masterdata/units-of-measure`);
            },
            onError: (error: unknown) => {
                const err = error as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } };
                if (err.response?.data?.errors) {
                    const backendErrors = err.response.data.errors;
                    const mappedErrors: Record<string, string[]> = {};

                    if (backendErrors.name) mappedErrors.name = backendErrors.name;
                    if (backendErrors.description) mappedErrors.description = backendErrors.description;

                    // Fallback for other field names if backend uses different casing
                    if (backendErrors.UnitName) mappedErrors.name = backendErrors.UnitName;
                    if (backendErrors.Description) mappedErrors.description = backendErrors.Description;

                    setErrors(mappedErrors);

                    if (Object.keys(mappedErrors).length === 0 && Object.keys(backendErrors).length > 0) {
                        toast.error('Please check the form for errors');
                    }
                } else {
                    toast.error(err.response?.data?.message || (error as Error).message || `Failed to ${isEditing ? 'update' : 'create'} unit of measure`);
                }
            },
        });
    };

    const isLoading = isEditing && unitLoading;
    const isSaving = createMutation.isPending || updateMutation.isPending;

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
            </div>
        );
    }

    if (isEditing && !unit && !isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">Unit Not Found</h1>
                    <p className="text-slate-600 mb-4">The unit of measure you&apos;re looking for doesn&apos;t exist.</p>
                    <button
                        onClick={() => router.push(`${baseRoute}/masterdata/units-of-measure`)}
                        className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)]"
                    >
                        Back to Units
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
                                {isEditing ? 'Edit Unit of Measure' : 'New Unit of Measure'}
                            </h1>
                            <p className="text-sm text-slate-500">
                                {isEditing ? 'Update unit of measure details' : 'Create a new unit of measure record'}
                            </p>
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
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Unit Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-colors ${errors.name ? 'border-red-300 focus:ring-red-200' : 'border-slate-300'
                                    }`}
                                placeholder="e.g., Piece, Kilogram, Liter"
                            />
                            {errors.name && (
                                <p className="mt-1 text-sm text-red-600">{errors.name[0]}</p>
                            )}
                        </div>

                        {/* Description Field */}
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
                            disabled={isSaving}
                            className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 font-medium"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    {isEditing ? 'Save Changes' : 'Create Unit'}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
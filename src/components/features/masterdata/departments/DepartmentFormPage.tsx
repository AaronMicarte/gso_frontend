'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDepartment, useCreateDepartment, useUpdateDepartment } from '@/lib/hooks/masterData';
import { DepartmentInput } from '@/types/masterData';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface DepartmentFormPageProps {
    baseRoute: string;
    departmentId?: number;
}

export function DepartmentFormPage({ baseRoute, departmentId }: DepartmentFormPageProps) {
    const router = useRouter();
    const isEditing = !!departmentId;

    const { data: department, isLoading: departmentLoading } = useDepartment(departmentId || null);
    const createMutation = useCreateDepartment();
    const updateMutation = useUpdateDepartment();

    const [formData, setFormData] = useState<DepartmentInput>({
        DepartmentCode: '',
        DepartmentName: '',
        Description: '',
    });

    const [errors, setErrors] = useState<Record<string, string[]>>({});

    useEffect(() => {
        if (department && isEditing) {
            // Ensure we always set strings (never undefined) so inputs stay controlled
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setFormData({
                DepartmentCode: department.code || '',
                DepartmentName: department.name || '',
                Description: department.description || '',
            });
        }
    }, [department, isEditing]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});

        const mutation = isEditing ? updateMutation : createMutation;
        const payload = isEditing ? { id: departmentId!, data: formData } : formData;

        // @ts-expect-error - Type mismatch between create and update payloads
        mutation.mutate(payload, {
            onSuccess: () => {
                toast.success(`Department ${isEditing ? 'updated' : 'created'} successfully`);
                router.push(`${baseRoute}/masterdata/departments`);
            },
            onError: (error: unknown) => {
                const err = error as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } };
                if (err.response?.data?.errors) {
                    setErrors(err.response.data.errors);
                } else {
                    toast.error(err.response?.data?.message || (error as Error).message || `Failed to ${isEditing ? 'update' : 'create'} department`);
                }
            },
        });
    };

    const handleChange = (field: keyof DepartmentInput, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const isLoading = isEditing && departmentLoading;
    const isSaving = createMutation.isPending || updateMutation.isPending;

    if (isEditing && !department && !isLoading) {
        return (
            <div className="min-h-screen bg-app print:hidden flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">Department Not Found</h1>
                    <p className="text-slate-600 mb-4">The department you&apos;re looking for doesn&apos;t exist.</p>
                    <button
                        onClick={() => router.push(`${baseRoute}/masterdata/departments`)}
                        className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)]"
                    >
                        Back to Departments
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-app print:hidden">
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
                                {isEditing ? 'Edit Department' : 'Add New Department'}
                            </h1>
                            <p className="text-sm text-slate-500 mt-1">
                                {isEditing ? 'Update department details' : 'Create a new organization department'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-6 max-w-2xl">
                <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                    <div className="mb-6">
                        <label htmlFor="code" className="block text-sm font-medium text-slate-700 mb-2">
                            Department Code <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            id="code"
                            value={formData.DepartmentCode ?? ''}
                            onChange={(e) => handleChange('DepartmentCode', e.target.value)}
                            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${errors.DepartmentCode ? 'border-red-500' : 'border-slate-300'}`}
                            placeholder="e.g., ICT"
                            required
                        />
                        {errors.DepartmentCode && (
                            <p className="text-red-500 text-sm mt-1">{errors.DepartmentCode[0]}</p>
                        )}
                    </div>

                    <div className="mb-6">
                        <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
                            Department Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            id="name"
                            value={formData.DepartmentName ?? ''}
                            onChange={(e) => handleChange('DepartmentName', e.target.value)}
                            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${errors.DepartmentName ? 'border-red-500' : 'border-slate-300'}`}
                            placeholder="e.g., Information and Communications Technology"
                            required
                        />
                        {errors.DepartmentName && (
                            <p className="text-red-500 text-sm mt-1">{errors.DepartmentName[0]}</p>
                        )}
                    </div>

                    <div className="mb-6">
                        <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-2">
                            Description
                        </label>
                        <textarea
                            id="description"
                            value={formData.Description ?? ''}
                            onChange={(e) => handleChange('Description', e.target.value)}
                            rows={4}
                            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${errors.Description ? 'border-red-500' : 'border-slate-300'}`}
                            placeholder="Optional description..."
                        />
                        {errors.Description && (
                            <p className="text-red-500 text-sm mt-1">{errors.Description[0]}</p>
                        )}
                    </div>

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
                                    {isEditing ? 'Save Changes' : 'Create Department'}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
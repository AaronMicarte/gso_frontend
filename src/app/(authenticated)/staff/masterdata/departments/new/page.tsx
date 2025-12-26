'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DepartmentInput } from '@/types/masterData';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateDepartment } from '@/lib/hooks/masterData';

export default function StaffNewDepartmentPage() {
    const router = useRouter();
    const [errors, setErrors] = useState<Record<string, string[]>>({});
    const [formData, setFormData] = useState<DepartmentInput>({
        DepartmentCode: '',
        DepartmentName: '',
        Description: '',
    });

    const createDepartmentMutation = useCreateDepartment();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});

        createDepartmentMutation.mutate(formData, {
            onSuccess: () => {
                // Toast is handled by the hook
                setTimeout(() => router.push('/staff/masterdata/departments'), 100);
            },
            onError: (error: unknown) => {
                const err = error as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } };
                if (err.response?.data?.errors) {
                    const backendErrors = err.response.data.errors;
                    const mappedErrors: Record<string, string[]> = {};
                    // Map backend errors to frontend fields if necessary
                    if (backendErrors.DepartmentCode) mappedErrors.code = backendErrors.DepartmentCode;
                    if (backendErrors.DepartmentName) mappedErrors.name = backendErrors.DepartmentName;
                    if (backendErrors.Description) mappedErrors.description = backendErrors.Description;

                    // Fallback to direct mapping if specific keys aren't found
                    if (Object.keys(mappedErrors).length === 0) {
                        setErrors(backendErrors);
                    } else {
                        setErrors(mappedErrors);
                    }
                } else {
                    toast.error(err.response?.data?.message || (error as Error).message || 'Failed to create department');
                }
            },
        });
    };

    const handleChange = (field: keyof DepartmentInput, value: string) => {
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
                            <h1 className="text-2xl font-bold text-slate-800">Add New Department</h1>
                            <p className="text-sm text-slate-500 mt-1">Create a new organization department</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Form */}
            <div className="p-6 max-w-2xl">
                <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                    {/* Department Code */}
                    <div className="mb-6">
                        <label htmlFor="code" className="block text-sm font-medium text-slate-700 mb-2">
                            Department Code <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            id="code"
                            value={formData.DepartmentCode}
                            onChange={(e) => handleChange('DepartmentCode', e.target.value)}
                            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${errors.code ? 'border-red-500' : 'border-slate-300'
                                }`}
                            placeholder="e.g., ICT"
                            required
                        />
                        {errors.code && (
                            <p className="mt-1 text-sm text-red-600">{errors.code[0]}</p>
                        )}
                    </div>

                    {/* Department Name */}
                    <div className="mb-6">
                        <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
                            Department Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            id="name"
                            value={formData.DepartmentName}
                            onChange={(e) => handleChange('DepartmentName', e.target.value)}
                            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${errors.name ? 'border-red-500' : 'border-slate-300'
                                }`}
                            placeholder="e.g., Information and Communications Technology"
                            required
                        />
                        {errors.name && (
                            <p className="mt-1 text-sm text-red-600">{errors.name[0]}</p>
                        )}
                    </div>

                    {/* Description */}
                    <div className="mb-6">
                        <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-2">
                            Description
                        </label>
                        <textarea
                            id="description"
                            value={formData.Description}
                            onChange={(e) => handleChange('Description', e.target.value)}
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
                            disabled={createDepartmentMutation.isPending}
                            className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            {createDepartmentMutation.isPending ? 'Saving...' : 'Save Department'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

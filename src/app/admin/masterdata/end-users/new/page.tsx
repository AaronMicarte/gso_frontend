'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateEndUser, useAllDepartments, useAllPositions } from '@/lib/hooks/masterData';
import { EndUserInput } from '@/types/masterData';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function NewEndUserPage() {
    const router = useRouter();
    const createMutation = useCreateEndUser();
    const { data: departments, isLoading: departmentsLoading } = useAllDepartments();
    const { data: positions, isLoading: positionsLoading } = useAllPositions();

    const [formData, setFormData] = useState<EndUserInput>({
        full_name: '',
        department_id: 0,
        position_id: 0,
        contact_number: '',
        email: '',
        is_active: true,
    });

    const [errors, setErrors] = useState<Record<string, string[]>>({});

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});

        createMutation.mutate(formData, {
            onSuccess: () => {
                toast.success('End user created successfully');
                router.push('/admin/masterdata/end-users');
            },
            onError: (error: any) => {
                if (error?.response?.data?.errors) {
                    const backendErrors = error.response.data.errors;
                    const mappedErrors: Record<string, string[]> = {};

                    if (backendErrors.full_name) mappedErrors.full_name = backendErrors.full_name;
                    if (backendErrors.department_id) mappedErrors.department_id = backendErrors.department_id;
                    if (backendErrors.position_id) mappedErrors.position_id = backendErrors.position_id;
                    if (backendErrors.contact_number) mappedErrors.contact_number = backendErrors.contact_number;
                    if (backendErrors.email) mappedErrors.email = backendErrors.email;

                    // Map backend PascalCase to frontend camelCase
                    if (backendErrors.FullName) mappedErrors.full_name = backendErrors.FullName;
                    if (backendErrors.DepartmentID) mappedErrors.department_id = backendErrors.DepartmentID;
                    if (backendErrors.PositionID) mappedErrors.position_id = backendErrors.PositionID;
                    if (backendErrors.ContactNumber) mappedErrors.contact_number = backendErrors.ContactNumber;
                    if (backendErrors.Email) mappedErrors.email = backendErrors.Email;

                    setErrors(mappedErrors);

                    if (Object.keys(mappedErrors).length === 0 && Object.keys(backendErrors).length > 0) {
                        toast.error('Please check the form for errors');
                    }
                } else {
                    toast.error('Failed to create end user');
                }
            },
        });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === 'checkbox'
                ? (e.target as HTMLInputElement).checked
                : name.includes('_id') ? Number(value) : value,
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

    const isLoading = departmentsLoading || positionsLoading;

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
                                New End User
                            </h1>
                            <p className="text-sm text-slate-500 mt-1">Create a new end user</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
                <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-slate-200">
                    <div className="p-6 space-y-6">
                        {/* Full Name Field */}
                        <div>
                            <label htmlFor="full_name" className="block text-sm font-medium text-slate-700 mb-1">
                                Full Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                id="full_name"
                                name="full_name"
                                value={formData.full_name}
                                onChange={handleChange}
                                className={`w-full px-4 py-2 rounded-lg border ${errors.full_name ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:ring-[var(--primary)]'
                                    } focus:outline-none focus:ring-2 transition-all`}
                                placeholder="Enter full name"
                                required
                            />
                            {errors.full_name && (
                                <p className="mt-1 text-sm text-red-500">{errors.full_name[0]}</p>
                            )}
                        </div>

                        {/* Email Field */}
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                                Email
                            </label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email || ''}
                                onChange={handleChange}
                                className={`w-full px-4 py-2 rounded-lg border ${errors.email ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:ring-[var(--primary)]'
                                    } focus:outline-none focus:ring-2 transition-all`}
                                placeholder="Enter email address"
                            />
                            {errors.email && (
                                <p className="mt-1 text-sm text-red-500">{errors.email[0]}</p>
                            )}
                        </div>

                        {/* Contact Number Field */}
                        <div>
                            <label htmlFor="contact_number" className="block text-sm font-medium text-slate-700 mb-1">
                                Contact Number
                            </label>
                            <input
                                type="text"
                                id="contact_number"
                                name="contact_number"
                                value={formData.contact_number || ''}
                                onChange={handleChange}
                                className={`w-full px-4 py-2 rounded-lg border ${errors.contact_number ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:ring-[var(--primary)]'
                                    } focus:outline-none focus:ring-2 transition-all`}
                                placeholder="Enter contact number"
                            />
                            {errors.contact_number && (
                                <p className="mt-1 text-sm text-red-500">{errors.contact_number[0]}</p>
                            )}
                        </div>

                        {/* Department Field */}
                        <div>
                            <label htmlFor="department_id" className="block text-sm font-medium text-slate-700 mb-1">
                                Department <span className="text-red-500">*</span>
                            </label>
                            <select
                                id="department_id"
                                name="department_id"
                                value={formData.department_id}
                                onChange={handleChange}
                                className={`w-full px-4 py-2 rounded-lg border ${errors.department_id ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:ring-[var(--primary)]'
                                    } focus:outline-none focus:ring-2 transition-all`}
                                required
                            >
                                <option value={0}>Select a department</option>
                                {departments?.map((dept: any) => (
                                    <option key={dept.id} value={dept.id}>
                                        {dept.name}
                                    </option>
                                ))}
                            </select>
                            {errors.department_id && (
                                <p className="mt-1 text-sm text-red-500">{errors.department_id[0]}</p>
                            )}
                        </div>

                        {/* Position Field */}
                        <div>
                            <label htmlFor="position_id" className="block text-sm font-medium text-slate-700 mb-1">
                                Position <span className="text-red-500">*</span>
                            </label>
                            <select
                                id="position_id"
                                name="position_id"
                                value={formData.position_id}
                                onChange={handleChange}
                                className={`w-full px-4 py-2 rounded-lg border ${errors.position_id ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:ring-[var(--primary)]'
                                    } focus:outline-none focus:ring-2 transition-all`}
                                required
                            >
                                <option value={0}>Select a position</option>
                                {positions?.map((pos: any) => (
                                    <option key={pos.id} value={pos.id}>
                                        {pos.name}
                                    </option>
                                ))}
                            </select>
                            {errors.position_id && (
                                <p className="mt-1 text-sm text-red-500">{errors.position_id[0]}</p>
                            )}
                        </div>

                        {/* Is Active Field */}
                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="is_active"
                                name="is_active"
                                checked={formData.is_active}
                                onChange={handleChange}
                                className="h-4 w-4 text-[var(--primary)] focus:ring-[var(--primary)] border-slate-300 rounded"
                            />
                            <label htmlFor="is_active" className="ml-2 block text-sm text-slate-700">
                                Active Status
                            </label>
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
                                    Create End User
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

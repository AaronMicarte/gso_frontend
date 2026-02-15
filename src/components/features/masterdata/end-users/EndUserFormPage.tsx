'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useEndUser, useCreateEndUser, useUpdateEndUser, useAllDepartments, useAllPositions } from '@/lib/hooks/masterData';
import { EndUserInput, Department, Position } from '@/types/masterData';
import { ApiError } from '@/types/api';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface EndUserFormPageProps {
    baseRoute: string;
    endUserId?: number;
}

export function EndUserFormPage({ baseRoute, endUserId }: EndUserFormPageProps) {
    const router = useRouter();
    const isEditing = !!endUserId;

    const { data: endUser, isLoading: endUserLoading } = useEndUser(endUserId || null);
    const createMutation = useCreateEndUser();
    const updateMutation = useUpdateEndUser();
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

    useEffect(() => {
        if (endUser && isEditing) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setFormData({
                full_name: endUser.full_name,
                department_id: endUser.department_id,
                position_id: endUser.position_id,
                contact_number: endUser.contact_number || '',
                email: endUser.email || '',
                is_active: endUser.is_active,
            });
        }
    }, [endUser, isEditing]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});

        const mutation = isEditing ? updateMutation : createMutation;
        const payload = isEditing ? { id: endUserId!, data: formData } : formData;

        // @ts-expect-error - mutation types are slightly different but compatible enough for this logic
        mutation.mutate(payload, {
            onSuccess: () => {
                toast.success(`End user ${isEditing ? 'updated' : 'created'} successfully`);
                router.push(`${baseRoute}/masterdata/end-users`);
            },
            onError: (error: Error) => {
                const apiError = error as ApiError;
                if (apiError?.response?.data?.errors) {
                    const backendErrors = apiError.response.data.errors;
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
                    toast.error(apiError?.response?.data?.message || error.message || `Failed to ${isEditing ? 'update' : 'create'} end user`);
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

    const isLoading = departmentsLoading || positionsLoading || (isEditing && endUserLoading);
    const isSaving = createMutation.isPending || updateMutation.isPending;

    if (isLoading) {
        return (
            <div className="min-h-screen bg-app print:hidden flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
            </div>
        );
    }

    if (isEditing && !endUser && !isLoading) {
        return (
            <div className="min-h-screen bg-app print:hidden flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">End User Not Found</h1>
                    <p className="text-slate-600 mb-4">The end user you&apos;re looking for doesn&apos;t exist.</p>
                    <button
                        onClick={() => router.push(`${baseRoute}/masterdata/end-users`)}
                        className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)]"
                    >
                        Back to End Users
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-app print:hidden">
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
                                {isEditing ? 'Edit End User' : 'New End User'}
                            </h1>
                            <p className="text-sm text-slate-500 mt-1">
                                {isEditing ? 'Update end user details' : 'Create a new end user'}
                            </p>
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
                                {departments?.map((dept: Department) => (
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
                                {positions?.map((pos: Position) => (
                                    <option key={pos.id} value={pos.id}>
                                        {pos.name}
                                    </option>
                                ))}
                            </select>
                            {errors.position_id && (
                                <p className="mt-1 text-sm text-red-500">{errors.position_id[0]}</p>
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
                                    {isEditing ? 'Save Changes' : 'Create End User'}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
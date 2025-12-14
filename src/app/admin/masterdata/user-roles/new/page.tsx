'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserRoleInput } from '@/types/masterData';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateUserRole } from '@/lib/hooks/masterData';

export default function NewUserRolePage() {
    const router = useRouter();
    const [errors, setErrors] = useState<Record<string, string[]>>({});
    const [formData, setFormData] = useState<UserRoleInput>({
        name: '',
        description: '',
    });

    const createUserRoleMutation = useCreateUserRole();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});

        createUserRoleMutation.mutate(formData, {
            onSuccess: () => {
                toast.success('User role created successfully');
                router.push('/admin/masterdata/user-roles');
            },
            onError: (error: any) => {
                if (error?.response?.data?.errors) {
                    const backendErrors = error.response.data.errors;
                    const mappedErrors: Record<string, string[]> = {};
                    // Map backend errors to frontend fields if necessary
                    if (backendErrors.RoleName) mappedErrors.name = backendErrors.RoleName;
                    if (backendErrors.Description) mappedErrors.description = backendErrors.Description;

                    // Fallback to direct mapping if specific keys aren't found
                    if (Object.keys(mappedErrors).length === 0) {
                        setErrors(backendErrors);
                    } else {
                        setErrors(mappedErrors);
                    }
                } else {
                    toast.error('Failed to create user role');
                }
            },
        });
    };

    const handleChange = (field: keyof UserRoleInput, value: string) => {
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
                            <h1 className="text-2xl font-bold text-slate-800">Add New User Role</h1>
                            <p className="text-sm text-slate-500 mt-1">Create a new user role type</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Form */}
            <div className="p-6 max-w-2xl">
                <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                    {/* User Role Name */}
                    <div className="mb-6">
                        <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
                            User Role Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            id="name"
                            value={formData.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${errors.name ? 'border-red-500' : 'border-slate-300'
                                }`}
                            placeholder="e.g., Admin"
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
                            disabled={createUserRoleMutation.isPending}
                            className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            {createUserRoleMutation.isPending ? 'Saving...' : 'Save User Role'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
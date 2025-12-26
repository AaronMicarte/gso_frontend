'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateSupplier, useUpdateSupplier, useSupplier } from '@/lib/hooks/masterData';
import { SupplierInput } from '@/types/masterData';
import { ApiError } from '@/types/api';
import { toast } from 'sonner';
import { ArrowLeft, Save } from 'lucide-react';

interface SupplierFormPageProps {
    baseRoute: string;
    supplierId?: number;
}

export function SupplierFormPage({ baseRoute, supplierId }: SupplierFormPageProps) {
    const router = useRouter();
    const isEditMode = !!supplierId;

    // Hooks for Edit Mode
    const { data: supplier, isLoading: isLoadingSupplier } = useSupplier(supplierId || null);
    const updateMutation = useUpdateSupplier();

    // Hooks for Create Mode
    const createMutation = useCreateSupplier();

    const [formData, setFormData] = useState<SupplierInput>({
        name: '',
        contact_person: '',
        contact_number: '',
        email: '',
        address: '',
        tin: '',
        is_active: true,
    });

    const [errors, setErrors] = useState<Record<string, string[]>>({});

    // Update form data when supplier data loads (Edit Mode)
    useEffect(() => {
        if (isEditMode && supplier) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setFormData({
                name: supplier.name,
                contact_person: supplier.contact_person || '',
                contact_number: supplier.contact_number || '',
                email: supplier.email || '',
                address: supplier.address || '',
                tin: supplier.tin || '',
                is_active: supplier.is_active,
            });
        }
    }, [isEditMode, supplier]);  

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});

        const onSuccess = () => {
            toast.success(isEditMode ? 'Supplier updated successfully' : 'Supplier created successfully');
            router.push(`${baseRoute}/masterdata/suppliers`);
        };

        const onError = (error: unknown) => {
            const apiError = error as ApiError;
            if (apiError?.response?.data?.errors) {
                const backendErrors = apiError.response.data.errors;
                const mappedErrors: Record<string, string[]> = {};

                if (backendErrors.name) mappedErrors.name = backendErrors.name;
                if (backendErrors.contact_person) mappedErrors.contact_person = backendErrors.contact_person;
                if (backendErrors.contact_number) mappedErrors.contact_number = backendErrors.contact_number;
                if (backendErrors.email) mappedErrors.email = backendErrors.email;
                if (backendErrors.address) mappedErrors.address = backendErrors.address;
                if (backendErrors.tin) mappedErrors.tin = backendErrors.tin;

                // Fallback for other field names if backend uses different casing
                if (backendErrors.SupplierName) mappedErrors.name = backendErrors.SupplierName;
                if (backendErrors.ContactPerson) mappedErrors.contact_person = backendErrors.ContactPerson;
                if (backendErrors.ContactNumber) mappedErrors.contact_number = backendErrors.ContactNumber;
                if (backendErrors.Email) mappedErrors.email = backendErrors.Email;
                if (backendErrors.Address) mappedErrors.address = backendErrors.Address;
                if (backendErrors.TIN) mappedErrors.tin = backendErrors.TIN;

                setErrors(mappedErrors);

                if (Object.keys(mappedErrors).length === 0 && Object.keys(backendErrors).length > 0) {
                    toast.error('Please check the form for errors');
                }
            } else {
                toast.error(apiError?.message || (isEditMode ? 'Failed to update supplier' : 'Failed to create supplier'));
            }
        };

        if (isEditMode && supplierId) {
            updateMutation.mutate({ id: supplierId, data: formData }, { onSuccess, onError });
        } else {
            createMutation.mutate(formData, { onSuccess, onError });
        }
    };

    const isLoading = isEditMode ? isLoadingSupplier : false;
    const isSaving = isEditMode ? updateMutation.isPending : createMutation.isPending;

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
            </div>
        );
    }

    if (isEditMode && !supplier) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-slate-800">Supplier not found</h2>
                    <button
                        onClick={() => router.back()}
                        className="mt-4 text-[var(--primary)] hover:underline"
                    >
                        Go back
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
                                {isEditMode ? 'Edit Supplier' : 'New Supplier'}
                            </h1>
                            <p className="text-sm text-slate-500">
                                {isEditMode ? 'Update supplier information' : 'Create a new supplier record'}
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
                                Supplier Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${errors.name ? 'border-red-500' : 'border-slate-300'
                                    }`}
                                placeholder="Enter supplier name"
                                required
                            />
                            {errors.name && (
                                <p className="mt-1 text-sm text-red-500">{errors.name[0]}</p>
                            )}
                        </div>

                        {/* Contact Person */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Contact Person
                            </label>
                            <input
                                type="text"
                                value={formData.contact_person}
                                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${errors.contact_person ? 'border-red-500' : 'border-slate-300'
                                    }`}
                                placeholder="Enter contact person name"
                            />
                            {errors.contact_person && (
                                <p className="mt-1 text-sm text-red-500">{errors.contact_person[0]}</p>
                            )}
                        </div>

                        {/* Contact Number */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Contact Number
                            </label>
                            <input
                                type="text"
                                value={formData.contact_number}
                                onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${errors.contact_number ? 'border-red-500' : 'border-slate-300'
                                    }`}
                                placeholder="Enter contact number"
                            />
                            {errors.contact_number && (
                                <p className="mt-1 text-sm text-red-500">{errors.contact_number[0]}</p>
                            )}
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Email Address
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${errors.email ? 'border-red-500' : 'border-slate-300'
                                    }`}
                                placeholder="Enter email address"
                            />
                            {errors.email && (
                                <p className="mt-1 text-sm text-red-500">{errors.email[0]}</p>
                            )}
                        </div>

                        {/* Address */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Address
                            </label>
                            <textarea
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                rows={3}
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${errors.address ? 'border-red-500' : 'border-slate-300'
                                    }`}
                                placeholder="Enter complete address"
                            />
                            {errors.address && (
                                <p className="mt-1 text-sm text-red-500">{errors.address[0]}</p>
                            )}
                        </div>

                        {/* TIN */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                TIN
                            </label>
                            <input
                                type="text"
                                value={formData.tin}
                                onChange={(e) => setFormData({ ...formData, tin: e.target.value })}
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${errors.tin ? 'border-red-500' : 'border-slate-300'
                                    }`}
                                placeholder="Enter Tax Identification Number"
                            />
                            {errors.tin && (
                                <p className="mt-1 text-sm text-red-500">{errors.tin[0]}</p>
                            )}
                        </div>

                        {/* Status */}
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="is_active"
                                checked={formData.is_active}
                                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                className="w-4 h-4 text-[var(--primary)] border-slate-300 rounded focus:ring-[var(--primary)]"
                            />
                            <label htmlFor="is_active" className="text-sm font-medium text-slate-700">
                                Active Status
                            </label>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 rounded-b-lg">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[var(--primary)] rounded-lg hover:bg-[var(--primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Save className="w-4 h-4" />
                            {isSaving ? 'Saving...' : (isEditMode ? 'Update Supplier' : 'Create Supplier')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
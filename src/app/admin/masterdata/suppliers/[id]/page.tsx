'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useSupplier, useUpdateSupplier } from '@/lib/hooks/masterData';
import { SupplierInput } from '@/types/masterData';
import { toast } from 'sonner';
import { ArrowLeft, Save } from 'lucide-react';

export default function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const resolvedParams = use(params);
    const supplierId = parseInt(resolvedParams.id);
    const { data: supplier, isLoading } = useSupplier(supplierId);
    const updateMutation = useUpdateSupplier();

    const [formData, setFormData] = useState<SupplierInput>({
        name: supplier?.name || '',
        contact_person: supplier?.contact_person || '',
        contact_number: supplier?.contact_number || '',
        email: supplier?.email || '',
        address: supplier?.address || '',
        tin: supplier?.tin || '',
        is_active: supplier?.is_active ?? true,
    });

    const [errors, setErrors] = useState<Record<string, string[]>>({});

    // Update form data when supplier data loads
    useEffect(() => {
        if (supplier) {
            setFormData({ // eslint-disable-line react-hooks/set-state-in-effect
                name: supplier.name,
                contact_person: supplier.contact_person || '',
                contact_number: supplier.contact_number || '',
                email: supplier.email || '',
                address: supplier.address || '',
                tin: supplier.tin || '',
                is_active: supplier.is_active,
            });
        }
    }, [supplier]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});

        updateMutation.mutate(
            { id: supplierId, data: formData },
            {
                onSuccess: () => {
                    toast.success('Supplier updated successfully');
                    router.push('/admin/masterdata/suppliers');
                },
                onError: (error: any) => {
                    if (error?.response?.data?.errors) {
                        const backendErrors = error.response.data.errors;
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
                        toast.error(error?.message || 'Failed to update supplier');
                    }
                },
            }
        );
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
            </div>
        );
    }

    if (!supplier) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">Supplier Not Found</h1>
                    <p className="text-slate-600 mb-4">The supplier you're looking for doesn't exist.</p>
                    <button
                        onClick={() => router.push('/admin/masterdata/suppliers')}
                        className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)]"
                    >
                        Back to Suppliers
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
                                Edit Supplier
                            </h1>
                            <p className="text-sm text-slate-500">Update supplier details</p>
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
                                required
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-colors ${errors.name ? 'border-red-300 focus:ring-red-200' : 'border-slate-300'
                                    }`}
                                placeholder="e.g., ABC Corporation"
                            />
                            {errors.name && (
                                <p className="mt-1 text-sm text-red-600">{errors.name[0]}</p>
                            )}
                        </div>

                        {/* Contact Person Field */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Contact Person
                            </label>
                            <input
                                type="text"
                                value={formData.contact_person}
                                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-colors ${errors.contact_person ? 'border-red-300 focus:ring-red-200' : 'border-slate-300'
                                    }`}
                                placeholder="e.g., John Doe"
                            />
                            {errors.contact_person && (
                                <p className="mt-1 text-sm text-red-600">{errors.contact_person[0]}</p>
                            )}
                        </div>

                        {/* Contact Number Field */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Contact Number
                            </label>
                            <input
                                type="text"
                                value={formData.contact_number}
                                onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-colors ${errors.contact_number ? 'border-red-300 focus:ring-red-200' : 'border-slate-300'
                                    }`}
                                placeholder="e.g., +63 912 345 6789"
                            />
                            {errors.contact_number && (
                                <p className="mt-1 text-sm text-red-600">{errors.contact_number[0]}</p>
                            )}
                        </div>

                        {/* Email Field */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Email Address
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-colors ${errors.email ? 'border-red-300 focus:ring-red-200' : 'border-slate-300'
                                    }`}
                                placeholder="e.g., contact@supplier.com"
                            />
                            {errors.email && (
                                <p className="mt-1 text-sm text-red-600">{errors.email[0]}</p>
                            )}
                        </div>

                        {/* Address Field */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Address
                            </label>
                            <textarea
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                rows={3}
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-colors ${errors.address ? 'border-red-300 focus:ring-red-200' : 'border-slate-300'
                                    }`}
                                placeholder="Complete business address"
                            />
                            {errors.address && (
                                <p className="mt-1 text-sm text-red-600">{errors.address[0]}</p>
                            )}
                        </div>

                        {/* TIN Field */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                TIN
                            </label>
                            <input
                                type="text"
                                value={formData.tin}
                                onChange={(e) => setFormData({ ...formData, tin: e.target.value })}
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-colors ${errors.tin ? 'border-red-300 focus:ring-red-200' : 'border-slate-300'
                                    }`}
                                placeholder="Tax Identification Number"
                            />
                            {errors.tin && (
                                <p className="mt-1 text-sm text-red-600">{errors.tin[0]}</p>
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
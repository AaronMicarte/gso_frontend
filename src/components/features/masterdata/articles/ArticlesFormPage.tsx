'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Package, ArrowLeft, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateArticle, useUpdateArticle, useArticle } from '@/lib/hooks/masterData';
import { useAllPropertyTypes } from '@/lib/hooks/masterData/usePropertyTypes';
import { useAllUnitsOfMeasure } from '@/lib/hooks/masterData/useUnitsOfMeasure';
import { ArticleInput } from '@/types/masterData';

const articleSchema = z.object({
    ArticleName: z.string().min(1, 'Article name is required').max(255, 'Article name is too long'),
    Description: z.string().max(1000, 'Description is too long').optional().or(z.literal('')),
    ArticleImage: z.custom<FileList>().optional(),
    RemoveImage: z.boolean().optional(),
    PropertyTypeID: z.coerce.number().min(1, 'Property type is required'),
    DefaultUnitOfMeasureID: z.coerce.number().min(1, 'Default unit is required'),
    IsActive: z.boolean().optional(),
});

type ArticleFormData = z.infer<typeof articleSchema>;

interface ArticlesFormPageProps {
    baseRoute: string;
}

export function ArticlesFormPage({ baseRoute }: ArticlesFormPageProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const mode = searchParams.get('mode') as 'create' | 'edit';
    const articleId = searchParams.get('id');

    const [isLoading, setIsLoading] = useState(false);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

    // React Query hooks
    const createMutation = useCreateArticle();
    const updateMutation = useUpdateArticle();
    const { data: existingArticle, isLoading: isLoadingArticle } = useArticle(
        mode === 'edit' && articleId ? parseInt(articleId) : 0,
        { enabled: mode === 'edit' && !!articleId }
    );

    // Form setup
    const {
        register,
        handleSubmit,
        formState: { errors, isDirty },
        setValue
        ,
        watch
    } = useForm<ArticleFormData>({
        resolver: zodResolver(articleSchema),
        defaultValues: {
            ArticleName: '',
            Description: '',
            RemoveImage: false,
            PropertyTypeID: 0,
            DefaultUnitOfMeasureID: 2,
            IsActive: true,
        }
    });

    const selectedImage = watch('ArticleImage');
    const removeImage = watch('RemoveImage');

    const { data: propertyTypesData } = useAllPropertyTypes();
    const { data: unitsData } = useAllUnitsOfMeasure();

    const propertyTypes = Array.isArray(propertyTypesData) ? propertyTypesData : [];

    type UnitOfMeasureResponse = { id?: number; name?: string; UnitOfMeasureID?: number; UnitName?: string };
    const units = Array.isArray(unitsData)
        ? (unitsData as UnitOfMeasureResponse[])
            .filter(u => u && (u.id ?? u.UnitOfMeasureID))
            .map(u => ({ id: u.id ?? u.UnitOfMeasureID!, name: u.name ?? u.UnitName! }))
        : [];

    // Populate form when editing
    useEffect(() => {
        if (mode === 'edit' && existingArticle) {
            setValue('ArticleName', existingArticle.name);
            setValue('Description', existingArticle.description || '');
            setValue('RemoveImage', false);
            setValue('PropertyTypeID', existingArticle.property_type_id);
            setValue('DefaultUnitOfMeasureID', existingArticle.default_unit_of_measure_id);
            setValue('IsActive', existingArticle.is_active);
            setImagePreviewUrl(existingArticle.image_url || null);
        }
    }, [existingArticle, mode, setValue]);

    useEffect(() => {
        const file = selectedImage?.[0];
        if (!file) {
            if (!removeImage && mode === 'edit' && existingArticle?.image_url) {
                setImagePreviewUrl(existingArticle.image_url);
            } else if (removeImage) {
                setImagePreviewUrl(null);
            }
            return;
        }

        const previewUrl = URL.createObjectURL(file);
        setImagePreviewUrl(previewUrl);

        return () => URL.revokeObjectURL(previewUrl);
    }, [selectedImage, removeImage, existingArticle, mode]);

    const onSubmit = async (data: ArticleFormData) => {
        if (isLoading) return;

        setIsLoading(true);
        try {
            const payload: ArticleInput = {
                ArticleName: data.ArticleName.trim(),
                Description: data.Description?.trim() || undefined,
                RemoveImage: data.RemoveImage ?? false,
                ArticleImage: data.RemoveImage ? null : (data.ArticleImage?.[0] || null),
                PropertyTypeID: data.PropertyTypeID,
                DefaultUnitOfMeasureID: data.DefaultUnitOfMeasureID,
                IsActive: data.IsActive ?? true,
            };

            if (mode === 'create') {
                await createMutation.mutateAsync(payload);
                toast.success('Article created successfully');
            } else if (mode === 'edit' && articleId) {
                await updateMutation.mutateAsync({
                    id: parseInt(articleId),
                    data: payload
                });
                toast.success('Article updated successfully');
            }

            router.push(baseRoute);
        } catch (error: unknown) {
            console.error('Form submission error:', error);
            const errorMessage = (() => {
                if (typeof error === 'object' && error !== null && 'response' in error) {
                    const response = (error as { response?: { data?: { message?: string } } }).response;
                    if (response?.data?.message) {
                        return response.data.message;
                    }
                }

                return `Failed to ${mode === 'create' ? 'create' : 'update'} article`;
            })();
            toast.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        if (isDirty) {
            if (window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
                router.push(baseRoute);
            }
        } else {
            router.push(baseRoute);
        }
    };

    if (mode === 'edit' && isLoadingArticle) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading article...</span>
            </div>
        );
    }

    if (mode === 'edit' && !existingArticle && !isLoadingArticle) {
        return (
            <div className="flex items-center justify-center p-8 text-red-600">
                <AlertCircle className="mr-2" />
                <span>Article not found</span>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-app print:hidden">
            <div className="p-4 sm:p-6 lg:p-8 space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleCancel}
                        className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            {mode === 'create' ? 'Create Article' : 'Edit Article'}
                        </h1>
                        <p className="text-sm text-gray-600">
                            {mode === 'create'
                                ? 'Add a new article type for government property items'
                                : 'Update article information'
                            }
                        </p>
                    </div>
                </div>

                {/* Form */}
                <div className="bg-white rounded-lg">
                    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
                        {/* Article Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Article Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                {...register('ArticleName')}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.ArticleName ? 'border-red-300' : 'border-gray-300'
                                    }`}
                                placeholder="Enter article name"
                            />
                            {errors.ArticleName && (
                                <p className="mt-1 text-sm text-red-600">{errors.ArticleName.message}</p>
                            )}
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Description
                            </label>
                            <textarea
                                {...register('Description')}
                                rows={3}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.Description ? 'border-red-300' : 'border-gray-300'
                                    }`}
                                placeholder="Enter article description (optional)"
                            />
                            {errors.Description && (
                                <p className="mt-1 text-sm text-red-600">{errors.Description.message}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Article Image
                            </label>
                            <input
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                                {...register('ArticleImage')}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            {imagePreviewUrl && (
                                <div className="mt-3">
                                    <img
                                        src={imagePreviewUrl}
                                        alt="Article preview"
                                        className="h-24 w-24 rounded-lg object-cover border border-gray-200"
                                    />
                                </div>
                            )}
                            {mode === 'edit' && existingArticle?.image_url && (
                                <label className="mt-3 inline-flex items-center gap-2 text-sm text-gray-700">
                                    <input
                                        type="checkbox"
                                        {...register('RemoveImage')}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    Remove current image
                                </label>
                            )}
                            <p className="mt-1 text-xs text-gray-500">Supported: JPG, PNG, GIF, WEBP. Max size: 2MB.</p>
                            {errors.ArticleImage && (
                                <p className="mt-1 text-sm text-red-600">Invalid image file</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Property Type <span className="text-red-500">*</span>
                            </label>
                            <select
                                {...register('PropertyTypeID', { valueAsNumber: true })}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.PropertyTypeID ? 'border-red-300' : 'border-gray-300'
                                    }`}
                            >
                                <option value={0}>Select property type</option>
                                {propertyTypes.map((pt) => (
                                    <option key={pt.id} value={pt.id}>{pt.name}</option>
                                ))}
                            </select>
                            {errors.PropertyTypeID && (
                                <p className="mt-1 text-sm text-red-600">{errors.PropertyTypeID.message}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Default Unit of Measure <span className="text-red-500">*</span>
                            </label>
                            <select
                                {...register('DefaultUnitOfMeasureID', { valueAsNumber: true })}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.DefaultUnitOfMeasureID ? 'border-red-300' : 'border-gray-300'
                                    }`}
                            >
                                <option value={0}>Select unit</option>
                                {units.map((unit) => (
                                    <option key={unit.id} value={unit.id}>{unit.name}</option>
                                ))}
                            </select>
                            {errors.DefaultUnitOfMeasureID && (
                                <p className="mt-1 text-sm text-red-600">{errors.DefaultUnitOfMeasureID.message}</p>
                            )}
                        </div>

                        {/* Active Status */}
                        <div>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    {...register('IsActive')}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm font-medium text-gray-700">
                                    Active
                                </span>
                            </label>
                            <p className="mt-1 text-sm text-gray-500">
                                Inactive articles will not be available for selection in delivery receipts
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-6 border-t border-gray-200">
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                {isLoading && (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                )}
                                {mode === 'create' ? 'Create Article' : 'Update Article'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
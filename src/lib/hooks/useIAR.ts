import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getIARs, getIAR, createIAR, updateIAR, deleteIAR, IARFilters } from '@/lib/api/procurement/iar';
import { UpdateIARPayload } from '@/types/iar';

export const useIARs = (filters?: IARFilters) => {
    return useQuery({
        queryKey: ['iars', filters],
        queryFn: () => getIARs(filters),
    });
};

export const useIAR = (id: number) => {
    return useQuery({
        queryKey: ['iar', id],
        queryFn: () => getIAR(id),
        enabled: !!id,
    });
};

export const useCreateIAR = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createIAR,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['iars'] });
            queryClient.invalidateQueries({ queryKey: ['delivery-receipts'] });
        },
    });
};

export const useUpdateIAR = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: UpdateIARPayload }) => updateIAR(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['iar', variables.id] });
            queryClient.invalidateQueries({ queryKey: ['iars'] });
        },
    });
};

export const useDeleteIAR = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteIAR,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['iars'] });
        },
    });
};

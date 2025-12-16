import { seriesApi } from "@/services/api/client";
import type { Series } from "@/types/story";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

// Query keys factory (internal use only)
const seriesKeys = {
    all: ["series"] as const,
    lists: () => [...seriesKeys.all, "list"] as const,
    list: () => [...seriesKeys.lists()] as const,
    details: () => [...seriesKeys.all, "detail"] as const,
    detail: (id: string) => [...seriesKeys.details(), id] as const,
    stories: (id: string) => [...seriesKeys.detail(id), "stories"] as const,
    lorebook: (id: string) => [...seriesKeys.detail(id), "lorebook"] as const
};

// Query: List all series
export const useSeriesQuery = () =>
    useQuery({
        queryKey: seriesKeys.list(),
        queryFn: seriesApi.getAll
    });

// Query: Single series by ID
export const useSingleSeriesQuery = (id: string | undefined) =>
    useQuery({
        queryKey: seriesKeys.detail(id ?? ""),
        queryFn: () => seriesApi.getById(id ?? ""),
        enabled: !!id
    });

// Mutation: Create series
export const useCreateSeriesMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: seriesApi.create,
        onSuccess: () => {
            // Invalidate series list
            queryClient.invalidateQueries({ queryKey: seriesKeys.lists() });
            toast.success("Series created successfully");
        },
        onError: (error: Error) => {
            toast.error(`Failed to create series: ${error.message}`);
        }
    });
};

// Mutation: Update series
export const useUpdateSeriesMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Omit<Series, "id" | "createdAt">> }) =>
            seriesApi.update(id, data),
        onSuccess: (_data, variables) => {
            // Invalidate specific series and list
            queryClient.invalidateQueries({ queryKey: seriesKeys.detail(variables.id) });
            queryClient.invalidateQueries({ queryKey: seriesKeys.lists() });
            toast.success("Series updated successfully");
        },
        onError: (error: Error) => {
            toast.error(`Failed to update series: ${error.message}`);
        }
    });
};

// Mutation: Delete series
export const useDeleteSeriesMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: seriesApi.delete,
        onSuccess: () => {
            // Invalidate series list and stories list (orphaned stories update)
            queryClient.invalidateQueries({ queryKey: seriesKeys.lists() });
            queryClient.invalidateQueries({ queryKey: ["stories"] });
            toast.success("Series deleted successfully");
        },
        onError: (error: Error) => {
            toast.error(`Failed to delete series: ${error.message}`);
        }
    });
};

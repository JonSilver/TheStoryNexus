import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { storiesApi } from "@/services/api/client";
import type { Story } from "@/types/story";

// Query keys
const storiesKeys = {
    all: ["stories"] as const,
    detail: (id: string) => ["stories", id] as const
};

// Fetch all stories
export const useStoriesQuery = () =>
    useQuery({
        queryKey: storiesKeys.all,
        queryFn: storiesApi.getAll
    });

// Fetch single story
export const useStoryQuery = (id: string) =>
    useQuery({
        queryKey: storiesKeys.detail(id),
        queryFn: () => storiesApi.getById(id),
        enabled: !!id
    });

// Create story mutation
export const useCreateStoryMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: storiesApi.create,
        onSuccess: data => {
            queryClient.invalidateQueries({ queryKey: storiesKeys.all });
            // Invalidate series stories list if story is assigned to a series
            if (data.seriesId) queryClient.invalidateQueries({ queryKey: ["series", data.seriesId, "stories"] });

            toast.success("Story created successfully");
        },
        onError: (error: Error) => {
            toast.error(`Failed to create story: ${error.message}`);
        }
    });
};

// Update story mutation
export const useUpdateStoryMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Story> }) => storiesApi.update(id, data),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: storiesKeys.all });
            queryClient.invalidateQueries({ queryKey: storiesKeys.detail(variables.id) });
            // Invalidate series stories list if seriesId was updated
            if (variables.data.seriesId !== undefined) {
                // Invalidate the new series
                if (variables.data.seriesId)
                    queryClient.invalidateQueries({ queryKey: ["series", variables.data.seriesId, "stories"] });

                // Also invalidate the old series (data contains the updated story with old seriesId still cached)
                queryClient.invalidateQueries({ queryKey: ["series"] });
            }
            toast.success("Story updated successfully");
        },
        onError: (error: Error) => {
            toast.error(`Failed to update story: ${error.message}`);
        }
    });
};

// Delete story mutation
export const useDeleteStoryMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: storiesApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: storiesKeys.all });
            toast.success("Story deleted successfully");
        },
        onError: (error: Error) => {
            toast.error(`Failed to delete story: ${error.message}`);
        }
    });
};

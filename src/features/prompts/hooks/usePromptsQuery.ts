import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { promptsApi } from "@/services/api/client";
import type { Prompt } from "@/types/story";

// Query keys (internal use only)
const promptsKeys = {
    all: ["prompts"] as const,
    lists: () => [...promptsKeys.all, "list"] as const,
    list: (params?: { storyId?: string; promptType?: string; includeSystem?: boolean }) =>
        [...promptsKeys.lists(), params] as const,
    detail: (id: string) => [...promptsKeys.all, id] as const
};

// Fetch all prompts
export const usePromptsQuery = (params?: { storyId?: string; promptType?: string; includeSystem?: boolean }) =>
    useQuery({
        queryKey: promptsKeys.list(params),
        queryFn: () => promptsApi.getAll(params)
    });

// Create prompt mutation
export const useCreatePromptMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: promptsApi.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: promptsKeys.lists() });
            toast.success("Prompt created successfully");
        },
        onError: (error: Error) => {
            toast.error(`Failed to create prompt: ${error.message}`);
        }
    });
};

// Update prompt mutation
export const useUpdatePromptMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Prompt> }) => promptsApi.update(id, data),
        onSuccess: (updatedPrompt, variables) => {
            // Update detail cache
            queryClient.setQueryData(promptsKeys.detail(variables.id), updatedPrompt);
            // Invalidate all list queries since they may have different params (includeSystem, etc)
            queryClient.invalidateQueries({ queryKey: promptsKeys.lists() });
            toast.success("Prompt updated successfully");
        },
        onError: (error: Error) => {
            toast.error(`Failed to update prompt: ${error.message}`);
        }
    });
};

// Delete prompt mutation
export const useDeletePromptMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: promptsApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: promptsKeys.lists() });
            toast.success("Prompt deleted successfully");
        },
        onError: (error: Error) => {
            toast.error(`Failed to delete prompt: ${error.message}`);
        }
    });
};

// Clone prompt mutation
export const useClonePromptMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            // Fetch the original prompt
            const originalPrompt = await promptsApi.getById(id);

            // Create cloned prompt data
            const { id: _id, createdAt: _createdAt, ...dataToClone } = originalPrompt;

            const clonedPromptData = {
                ...dataToClone,
                name: `${originalPrompt.name} (Copy)`,
                isSystem: false // Always false for cloned prompts
            };

            // Create the new prompt
            return promptsApi.create(clonedPromptData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: promptsKeys.lists() });
            toast.success("Prompt cloned successfully");
        },
        onError: (error: Error) => {
            toast.error(`Failed to clone prompt: ${error.message}`);
        }
    });
};

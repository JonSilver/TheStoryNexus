import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { brainstormApi } from "@/services/api/client";
import type { AIChat } from "@/types/story";

// Query keys
const brainstormKeys = {
    all: ["brainstorm"] as const,
    byStory: (storyId: string) => ["brainstorm", "story", storyId] as const,
    detail: (id: string) => ["brainstorm", id] as const
};

/**
 * Push a server-returned chat into both caches. Writes outside a mutation
 * (the conversation's guarded message writes) MUST call this. Revision-
 * monotonic: a late, older answer never replaces a newer cached chat.
 */
export const applyChatToCaches = (queryClient: ReturnType<typeof useQueryClient>, chat: AIChat) => {
    const newer = (cached?: AIChat) => !cached || (cached.revision ?? 0) <= (chat.revision ?? 0);
    if (newer(queryClient.getQueryData<AIChat>(brainstormKeys.detail(chat.id))))
        queryClient.setQueryData(brainstormKeys.detail(chat.id), chat);
    queryClient.setQueryData<AIChat[]>(brainstormKeys.byStory(chat.storyId), old =>
        old?.map(c => (c.id === chat.id && newer(c) ? chat : c))
    );
};

// Fetch brainstorm chats by story
export const useBrainstormByStoryQuery = (storyId: string) => {
    const queryClient = useQueryClient();
    return useQuery({
        queryKey: brainstormKeys.byStory(storyId),
        // A fetch that started before a save can answer after it: keep whichever copy is newer
        queryFn: async () => {
            const fetched = await brainstormApi.getByStory(storyId);
            const cached = queryClient.getQueryData<AIChat[]>(brainstormKeys.byStory(storyId)) ?? [];
            return fetched.map(chat => {
                const mine = cached.find(c => c.id === chat.id);
                return mine && (mine.revision ?? 0) > (chat.revision ?? 0) ? mine : chat;
            });
        },
        enabled: !!storyId
    });
};

// Create brainstorm chat mutation
export const useCreateBrainstormMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: brainstormApi.create,
        onSuccess: newChat => {
            queryClient.invalidateQueries({ queryKey: brainstormKeys.byStory(newChat.storyId) });
            toast.success("Brainstorm chat created successfully");
        },
        onError: (error: Error) => {
            toast.error(`Failed to create brainstorm chat: ${error.message}`);
        }
    });
};

// Delete brainstorm chat mutation
export const useDeleteBrainstormMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: brainstormApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: brainstormKeys.all });
            toast.success("Brainstorm chat deleted successfully");
        },
        onError: (error: Error) => {
            toast.error(`Failed to delete brainstorm chat: ${error.message}`);
        }
    });
};

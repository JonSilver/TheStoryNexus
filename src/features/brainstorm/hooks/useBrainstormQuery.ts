import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { brainstormApi } from "@/services/api/client";
import { brainstormKeys } from "@/services/api/queryKeys";
import type { AIChat } from "@/types/story";

/**
 * Push a server-returned chat into both caches. Writes outside a mutation
 * (the conversation's guarded message writes) MUST call this. Revision-
 * monotonic: a late, older answer never replaces a newer cached chat.
 */
export const applyChatToCaches = (queryClient: QueryClient, chat: AIChat) => {
    const newer = (cached?: AIChat) => !cached || (cached.revision ?? 0) <= (chat.revision ?? 0);
    if (newer(queryClient.getQueryData<AIChat>(brainstormKeys.detail(chat.id))))
        queryClient.setQueryData(brainstormKeys.detail(chat.id), chat);
    queryClient.setQueryData<AIChat[]>(brainstormKeys.byStory(chat.storyId), old =>
        old?.map(c => (c.id === chat.id && newer(c) ? chat : c))
    );
};

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

/** One chat by id — for links to a chat the story's list doesn't (yet) show. */
export const useBrainstormChatQuery = (chatId: string | null | undefined, enabled: boolean) =>
    useQuery({
        queryKey: brainstormKeys.detail(chatId ?? ""),
        queryFn: () => brainstormApi.getById(chatId ?? ""),
        enabled: enabled && !!chatId
    });

export const useCreateBrainstormMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: brainstormApi.create,
        onSuccess: chat => queryClient.invalidateQueries({ queryKey: brainstormKeys.byStory(chat.storyId) }),
        meta: { failure: "Couldn't start a chat" }
    });
};

export const useDeleteBrainstormMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: brainstormApi.delete,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: brainstormKeys.all }),
        meta: { failure: "Couldn't delete the chat" }
    });
};

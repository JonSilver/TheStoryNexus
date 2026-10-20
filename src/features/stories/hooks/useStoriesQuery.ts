import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { storiesApi } from "@/services/api/client";
import { lorebookKeys, seriesKeys, storiesKeys } from "@/services/api/queryKeys";
import type { Story } from "@/types/story";

export const useStoriesQuery = () => useQuery({ queryKey: storiesKeys.all, queryFn: storiesApi.getAll });

export const useStoryQuery = (id: string) =>
    useQuery({
        queryKey: storiesKeys.detail(id),
        queryFn: () => storiesApi.getById(id),
        enabled: !!id
    });

export const useCreateStoryMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: storiesApi.create,
        onSuccess: story => {
            void queryClient.invalidateQueries({ queryKey: storiesKeys.all });
            if (story.seriesId) void queryClient.invalidateQueries({ queryKey: seriesKeys.all });
        },
        meta: { failure: "Couldn't create the story" }
    });
};

export const useUpdateStoryMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Story> }) => storiesApi.update(id, data),
        onSuccess: (story, { data }) => {
            queryClient.setQueryData(storiesKeys.detail(story.id), story);
            void queryClient.invalidateQueries({ queryKey: storiesKeys.all });
            if (data.seriesId === undefined) return;
            // Membership moves the story between series lists, and changes which
            // bible entries it inherits
            void queryClient.invalidateQueries({ queryKey: seriesKeys.all });
            void queryClient.invalidateQueries({ queryKey: lorebookKeys.all });
        },
        meta: { failure: "Couldn't save the story" }
    });
};

/** A story JSON backup: it can bring chapters, bible, notes and images, so everything refreshes. */
export const useImportStoryMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: storiesApi.importStory,
        onSuccess: () => queryClient.invalidateQueries(),
        meta: { failure: "Couldn't import that JSON" }
    });
};

/** A copy of a story with everything a backup carries, in the same series. */
export const useDuplicateStoryMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: storiesApi.duplicate,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: storiesKeys.all }),
        meta: { failure: "Couldn't duplicate the story" }
    });
};

export const useDeleteStoryMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: storiesApi.delete,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: storiesKeys.all }),
        meta: { failure: "Couldn't delete the story" }
    });
};

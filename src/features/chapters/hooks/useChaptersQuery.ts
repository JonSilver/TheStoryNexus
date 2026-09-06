import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { chaptersApi } from "@/services/api/client";
import type { Chapter } from "@/types/story";

// Query keys (internal use only)
const chaptersKeys = {
    all: ["chapters"] as const,
    byStory: (storyId: string) => ["chapters", "story", storyId] as const,
    detail: (id: string) => ["chapters", id] as const
};

// Fetch chapters by story
export const useChaptersByStoryQuery = (storyId: string) =>
    useQuery({
        queryKey: chaptersKeys.byStory(storyId),
        queryFn: () => chaptersApi.getByStory(storyId),
        enabled: !!storyId
    });

// Fetch single chapter
export const useChapterQuery = (id: string) =>
    useQuery({
        queryKey: chaptersKeys.detail(id),
        queryFn: () => chaptersApi.getById(id),
        enabled: !!id
    });

// Create chapter mutation
export const useCreateChapterMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: chaptersApi.create,
        onSuccess: newChapter => {
            queryClient.invalidateQueries({ queryKey: chaptersKeys.byStory(newChapter.storyId) });
            toast.success("Chapter created successfully");
        },
        onError: (error: Error) => {
            toast.error(`Failed to create chapter: ${error.message}`);
        }
    });
};

// Push a server-returned chapter row into both caches. Anything that writes a
// chapter outside a mutation (the v2 editor saver, background summarise) MUST
// call this, or the next editor mount resurrects stale content and 409s.
export const applyChapterToCaches = (queryClient: ReturnType<typeof useQueryClient>, chapter: Chapter) => {
    queryClient.setQueryData(chaptersKeys.detail(chapter.id), chapter);
    queryClient.setQueryData<Chapter[]>(chaptersKeys.byStory(chapter.storyId), old =>
        old?.map(ch => (ch.id === chapter.id ? chapter : ch))
    );
};

// Update chapter mutation
export const useUpdateChapterMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Chapter> }) => chaptersApi.update(id, data),
        onSuccess: updatedChapter => applyChapterToCaches(queryClient, updatedChapter),
        onError: () => {
            toast.error("Failed to update chapter");
        }
    });
};

// Delete chapter mutation
export const useDeleteChapterMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: chaptersApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: chaptersKeys.all });
            toast.success("Chapter deleted successfully");
        },
        onError: (error: Error) => {
            toast.error(`Failed to delete chapter: ${error.message}`);
        }
    });
};

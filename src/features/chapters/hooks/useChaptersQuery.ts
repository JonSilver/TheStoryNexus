import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { chaptersApi } from "@/services/api/client";
import { chaptersKeys } from "@/services/api/queryKeys";
import type { Chapter } from "@/types/story";
import { randomUUID } from "@/utils/crypto";

export const inRunningOrder = (chapters: Chapter[]) => [...chapters].sort((a, b) => a.order - b.order);

const storyChaptersQuery = (storyId: string) => ({
    queryKey: chaptersKeys.byStory(storyId),
    queryFn: () => chaptersApi.getByStory(storyId)
});

/** A story's chapters in running order. */
export const useChaptersByStoryQuery = (storyId: string) =>
    useQuery({ ...storyChaptersQuery(storyId), select: inRunningOrder, enabled: !!storyId });

export const useChapterQuery = (id: string) =>
    useQuery({
        queryKey: chaptersKeys.detail(id),
        queryFn: () => chaptersApi.getById(id),
        enabled: !!id
    });

// Push a server-returned chapter row into both caches. Anything that writes a
// chapter outside a mutation (the v2 editor saver, background summarise) MUST
// call this, or the next editor mount resurrects stale content and 409s.
export const applyChapterToCaches = (queryClient: QueryClient, chapter: Chapter) => {
    // Monotonicity: a late response from an older write must never overwrite a
    // newer cached row. Metadata writes share a saveVersion, so ties fall to updatedAt
    const cached = queryClient.getQueryData<Chapter>(chaptersKeys.detail(chapter.id));
    const cachedVersion = cached?.saveVersion ?? -1;
    const incomingVersion = chapter.saveVersion ?? -1;
    if (cachedVersion > incomingVersion) return;
    if (
        cached?.updatedAt &&
        chapter.updatedAt &&
        cachedVersion === incomingVersion &&
        new Date(cached.updatedAt).getTime() > new Date(chapter.updatedAt).getTime()
    )
        return;
    queryClient.setQueryData(chaptersKeys.detail(chapter.id), chapter);
    queryClient.setQueryData<Chapter[]>(chaptersKeys.byStory(chapter.storyId), old =>
        old?.map(ch => (ch.id === chapter.id ? chapter : ch))
    );
};

type NewChapter = { storyId: string; title: string; outline?: string };

/** A new chapter at the end of its story — after the last one, whatever gaps deletions left. */
export const useCreateChapter = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ storyId, title, outline }: NewChapter) => {
            const existing = await queryClient.ensureQueryData(storyChaptersQuery(storyId));
            return chaptersApi.create({
                id: randomUUID(),
                storyId,
                title,
                order: Math.max(-1, ...existing.map(ch => ch.order)) + 1,
                content: "",
                revision: 0,
                wordCount: 0,
                ...(outline ? { outline: { content: outline, lastUpdated: new Date() } } : {})
            });
        },
        onSuccess: chapter => queryClient.invalidateQueries({ queryKey: chaptersKeys.byStory(chapter.storyId) }),
        meta: { failure: "Couldn't create the chapter" }
    });
};

export const useUpdateChapterMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Chapter> }) => chaptersApi.update(id, data),
        onSuccess: updated => applyChapterToCaches(queryClient, updated),
        meta: { failure: "Couldn't save the chapter" }
    });
};

/** Moves one chapter a place up or down; the server renumbers the whole story at once. */
export const useMoveChapter = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ chapters, from, to }: { chapters: Chapter[]; from: number; to: number }) => {
            const ids = chapters.map(ch => ch.id);
            [ids[from], ids[to]] = [ids[to], ids[from]];
            return chaptersApi.reorder(chapters[from].storyId, ids);
        },
        onSuccess: chapters => chapters.forEach(chapter => applyChapterToCaches(queryClient, chapter)),
        onError: (_error, { chapters }) =>
            queryClient.invalidateQueries({ queryKey: chaptersKeys.byStory(chapters[0].storyId) }),
        meta: { failure: "Couldn't move the chapter" }
    });
};

export const useDeleteChapterMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: chaptersApi.delete,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: chaptersKeys.all }),
        meta: { failure: "Couldn't delete the chapter" }
    });
};

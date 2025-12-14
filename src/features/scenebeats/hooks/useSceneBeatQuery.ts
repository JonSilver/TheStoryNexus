import { scenebeatsApi } from "@/services/api/client";
import type { SceneBeat } from "@/types/story";
import { randomUUID } from "@/utils/crypto";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const sceneBeatKeys = {
    all: ["scenebeats"] as const,
    byId: (id: string) => [...sceneBeatKeys.all, id] as const,
    byChapter: (chapterId: string) => [...sceneBeatKeys.all, "chapter", chapterId] as const
};

export const useSceneBeatQuery = (id: string, options?: { enabled?: boolean }) =>
    useQuery({
        queryKey: sceneBeatKeys.byId(id),
        queryFn: () => scenebeatsApi.getById(id),
        enabled: options?.enabled ?? !!id,
        staleTime: 60 * 1000,
        retry: false
    });

export const useSceneBeatsByChapterQuery = (chapterId: string) =>
    useQuery({
        queryKey: sceneBeatKeys.byChapter(chapterId),
        queryFn: () => scenebeatsApi.getByChapter(chapterId),
        enabled: !!chapterId
    });

type CreateSceneBeatData = Omit<SceneBeat, "createdAt"> & { id?: string };

export const useCreateSceneBeatMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: CreateSceneBeatData) => {
            const id = data.id || randomUUID();
            return scenebeatsApi.create({ ...data, id });
        },
        onSuccess: sceneBeat => {
            queryClient.setQueryData(sceneBeatKeys.byId(sceneBeat.id), sceneBeat);
            queryClient.invalidateQueries({ queryKey: sceneBeatKeys.byChapter(sceneBeat.chapterId) });
        }
    });
};

type UpdateSceneBeatParams = { id: string; data: Partial<SceneBeat> };

export const useUpdateSceneBeatMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data }: UpdateSceneBeatParams) => scenebeatsApi.update(id, data),
        onSuccess: (sceneBeat, { id }) => {
            queryClient.setQueryData(sceneBeatKeys.byId(id), sceneBeat);
            queryClient.invalidateQueries({ queryKey: sceneBeatKeys.byChapter(sceneBeat.chapterId) });
        }
    });
};

export const useDeleteSceneBeatMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, chapterId }: { id: string; chapterId: string }) => {
            await scenebeatsApi.delete(id);
            return { id, chapterId };
        },
        onSuccess: ({ id, chapterId }) => {
            queryClient.removeQueries({ queryKey: sceneBeatKeys.byId(id) });
            queryClient.invalidateQueries({ queryKey: sceneBeatKeys.byChapter(chapterId) });
        }
    });
};

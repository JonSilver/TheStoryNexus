import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { seriesApi } from "@/services/api/client";
import { lorebookKeys, seriesKeys, storiesKeys } from "@/services/api/queryKeys";
import type { Series } from "@/types/story";

export const useSeriesQuery = () => useQuery({ queryKey: seriesKeys.list, queryFn: seriesApi.getAll });

export const useSingleSeriesQuery = (id: string | undefined) =>
    useQuery({
        queryKey: seriesKeys.detail(id ?? ""),
        queryFn: () => seriesApi.getById(id ?? ""),
        enabled: !!id
    });

const useSeriesWrite = <TVariables, TResult>(
    mutationFn: (variables: TVariables) => Promise<TResult>,
    failure: string
) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn,
        // Stories carry their series membership, and member stories inherit the
        // series' bible entries (deleted with it), so both refresh with it
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: seriesKeys.all });
            void queryClient.invalidateQueries({ queryKey: storiesKeys.all });
            void queryClient.invalidateQueries({ queryKey: lorebookKeys.all });
        },
        meta: { failure }
    });
};

export const useCreateSeriesMutation = () => useSeriesWrite(seriesApi.create, "Couldn't create the series");

export const useUpdateSeriesMutation = () =>
    useSeriesWrite(
        ({ id, data }: { id: string; data: Partial<Omit<Series, "id" | "createdAt">> }) => seriesApi.update(id, data),
        "Couldn't save the series"
    );

export const useDeleteSeriesMutation = () => useSeriesWrite(seriesApi.delete, "Couldn't delete the series");

export const useImportSeriesMutation = () => useSeriesWrite(seriesApi.importSeries, "Couldn't import that series");

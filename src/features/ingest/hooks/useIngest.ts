import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ingestApi } from "@/services/api/client";
import { storiesKeys } from "@/services/api/queryKeys";
import { orThrow } from "@/services/api/request";

/** Reading order by natural filename sort ("Chapter 2" before "Chapter 10"). */
const inReadingOrder = (files: File[]) =>
    [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));

export const useAnalyseFiles = () =>
    useMutation({
        mutationFn: async (files: File[]) => orThrow(await ingestApi.analyseFiles(inReadingOrder(files))),
        meta: { failure: "Couldn't read that file" }
    });

export const useAnalyseText = () =>
    useMutation({
        mutationFn: async (text: string) => orThrow(await ingestApi.analyseText(text)),
        meta: { failure: "Couldn't analyse that text" }
    });

export const useCommitImport = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (body: Parameters<typeof ingestApi.commit>[0]) => orThrow(await ingestApi.commit(body)),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: storiesKeys.all }),
        meta: { failure: "Import failed — nothing was created" }
    });
};

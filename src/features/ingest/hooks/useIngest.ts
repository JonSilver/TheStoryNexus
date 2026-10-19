import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { storiesKeys } from "@/features/stories/hooks/useStoriesQuery";
import { ingestApi } from "@/services/api/client";
import { orThrow } from "@/services/api/request";

/** Reading order by natural filename sort ("Chapter 2" before "Chapter 10"). */
const inReadingOrder = (files: File[]) =>
    [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));

export const useAnalyseFiles = () =>
    useMutation({
        mutationFn: async (files: File[]) => orThrow(await ingestApi.analyseFiles(inReadingOrder(files))),
        onError: (error: Error) => toast.error(error.message || "Couldn't read that file")
    });

export const useAnalyseText = () =>
    useMutation({
        mutationFn: async (text: string) => orThrow(await ingestApi.analyseText(text)),
        onError: () => toast.error("Couldn't analyse that text")
    });

export const useCommitImport = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (body: Parameters<typeof ingestApi.commit>[0]) => orThrow(await ingestApi.commit(body)),
        onSuccess: ({ chapterCount }) => {
            void queryClient.invalidateQueries({ queryKey: storiesKeys.all });
            toast.success(
                `Imported ${chapterCount} chapters — Story Bible → Extract from whole story builds your bible, and Story → Details, series & voice → Derive from my writing drafts your story's voice`
            );
        },
        onError: (error: Error) => toast.error(error.message || "Import failed — nothing was created")
    });
};

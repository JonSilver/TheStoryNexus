import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { transpositionsApi } from "@/services/api/client";
import { chaptersKeys, lorebookKeys, storiesKeys, transpositionKeys } from "@/services/api/queryKeys";
import type { TranspositionOp } from "@/v2/transpose/state";

/** The story's transposition, or null when it isn't being transposed. */
export const useTranspositionQuery = (storyId: string | null) =>
    useQuery({
        queryKey: transpositionKeys.detail(storyId ?? ""),
        queryFn: () => transpositionsApi.get(storyId ?? ""),
        enabled: !!storyId
    });

/** Starts one: the copy appears in the library, and opens. */
export const useStartTranspositionMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: transpositionsApi.start,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: storiesKeys.all }),
        meta: { failure: "Couldn't start the transposition" }
    });
};

// What else an op changes in the story, so screens showing it refresh
const ALSO_CHANGES: Partial<Record<TranspositionOp["op"], "story" | "bible" | "chapters">> = {
    acceptSynopsis: "story",
    acceptEntry: "bible",
    keepEntry: "bible",
    acceptChapter: "chapters"
};

export const useTranspositionOpMutation = (storyId: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (op: TranspositionOp) => transpositionsApi.apply({ storyId, op }),
        onSuccess: (transposition, op) => {
            queryClient.setQueryData(transpositionKeys.detail(storyId), transposition);
            const also = ALSO_CHANGES[op.op];
            if (also === "story") void queryClient.invalidateQueries({ queryKey: storiesKeys.detail(storyId) });
            if (also === "bible") void queryClient.invalidateQueries({ queryKey: lorebookKeys.all });
            if (also === "chapters") void queryClient.invalidateQueries({ queryKey: chaptersKeys.all });
        },
        meta: { failure: "Couldn't save that to the transposition" }
    });
};

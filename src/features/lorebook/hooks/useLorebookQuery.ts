import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lorebookApi } from "@/services/api/client";
import { lorebookKeys } from "@/services/api/queryKeys";
import type { LorebookEntry } from "@/types/story";

/** Global + series + story entries — what prompt context uses, so what the writer should see. */
export const useHierarchicalLorebookQuery = (storyId: string | undefined) =>
    useQuery({
        queryKey: lorebookKeys.hierarchical(storyId ?? ""),
        queryFn: () => lorebookApi.getHierarchical(storyId ?? ""),
        enabled: !!storyId
    });

/**
 * Any entry write can change every story's view (series and global entries
 * are inherited), so each one refreshes all bible queries. `reportsOwnFailures`:
 * the caller words failures itself — batches report one tally, not a toast per entry.
 */
const useLorebookWrite = <TVariables, TResult>(
    mutationFn: (variables: TVariables) => Promise<TResult>,
    failure: string,
    reportsOwnFailures = false
) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: lorebookKeys.all }),
        meta: { failure: reportsOwnFailures ? false : failure }
    });
};

export const useCreateLorebookMutation = ({ reportsOwnFailures = false } = {}) =>
    useLorebookWrite(lorebookApi.create, "Couldn't add the bible entry", reportsOwnFailures);

export const useUpdateLorebookMutation = ({ reportsOwnFailures = false } = {}) =>
    useLorebookWrite(
        ({ id, data }: { id: string; data: Partial<LorebookEntry> }) => lorebookApi.update(id, data),
        "Couldn't save the bible entry",
        reportsOwnFailures
    );

export const useDeleteLorebookMutation = ({ reportsOwnFailures = false } = {}) =>
    useLorebookWrite(lorebookApi.delete, "Couldn't delete the bible entry", reportsOwnFailures);

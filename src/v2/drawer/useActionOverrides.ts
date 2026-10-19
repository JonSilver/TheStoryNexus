import { attemptPromise } from "@jfdi/attempt";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { actionsApi } from "@/services/api/client";
import type { ActionId, OverridePayload } from "@/types/actions";

export type { ActionDefinition, OverridePayload, OverrideRow } from "@/types/actions";

const actionKeys = {
    registry: ["actions", "registry"] as const,
    overrides: ["actions", "overrides"] as const,
    overridesFor: (storyId: string | null) => ["actions", "overrides", storyId ?? "global"] as const
};

export const useActionRegistry = () =>
    useQuery({ queryKey: actionKeys.registry, queryFn: actionsApi.registry, staleTime: Infinity });

export const useOverrides = (storyId: string | null) =>
    useQuery({ queryKey: actionKeys.overridesFor(storyId), queryFn: () => actionsApi.overrides(storyId) });

/** Resolves true when saved; failures are told to the writer here. */
export const useSaveOverride = () => {
    const queryClient = useQueryClient();
    const mutation = useMutation({
        mutationFn: actionsApi.saveOverride,
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: actionKeys.overrides });
            toast.success("Override saved");
        },
        onError: (error: Error) => toast.error(error.message || "Couldn't save override")
    });
    return async (payload: OverridePayload) => !(await attemptPromise(() => mutation.mutateAsync(payload)))[0];
};

export const useResetOverride = () => {
    const queryClient = useQueryClient();
    const mutation = useMutation({
        mutationFn: ({ actionId, storyId }: { actionId: ActionId; storyId: string | null }) =>
            actionsApi.resetOverride(actionId, storyId),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: actionKeys.overrides });
            toast.success("Reset to built-in");
        },
        onError: () => toast.error("Couldn't reset override")
    });
    return async (actionId: ActionId, storyId: string | null) => {
        await attemptPromise(() => mutation.mutateAsync({ actionId, storyId }));
    };
};

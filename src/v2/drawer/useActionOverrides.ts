import { attemptPromise } from "@jfdi/attempt";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { actionsApi } from "@/services/api/client";
import { actionKeys } from "@/services/api/queryKeys";
import type { ActionId, OverridePayload } from "@/types/actions";

export type { ActionDefinition, OverridePayload, OverrideRow } from "@/types/actions";

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
        meta: { failure: "Couldn't save the override" }
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
        meta: { failure: "Couldn't reset the override" }
    });
    return async (actionId: ActionId, storyId: string | null) => {
        await attemptPromise(() => mutation.mutateAsync({ actionId, storyId }));
    };
};

/** Gives an action a model in one scope, leaving the rest of its override as it is. Resolves true when saved. */
export const useSetActionModel = () => {
    const queryClient = useQueryClient();
    const mutation = useMutation({
        mutationFn: (payload: Pick<OverridePayload, "actionId" | "storyId" | "modelRef">) =>
            actionsApi.saveOverride(payload),
        onSuccess: () => void queryClient.invalidateQueries({ queryKey: actionKeys.overrides }),
        meta: { failure: "Couldn't change the model" }
    });
    return async (payload: Pick<OverridePayload, "actionId" | "storyId" | "modelRef">) =>
        !(await attemptPromise(() => mutation.mutateAsync(payload)))[0];
};

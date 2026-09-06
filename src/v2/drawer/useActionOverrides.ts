import { attemptPromise } from "@jfdi/attempt";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import type { PromptMessage } from "@/types/story";
import type { ActionId } from "../ai/useActionGeneration";

export interface ActionDefinition {
    id: ActionId;
    label: string;
    voiceApplies: boolean;
    contextNeeds: string[];
    defaultTemplate: PromptMessage[];
    defaultParams: {
        temperature: number;
        maxTokens: number;
        topP?: number;
        frequencyPenalty?: number;
        presencePenalty?: number;
    };
}

export interface OverrideRow {
    id: string;
    actionId: ActionId;
    storyId: string | null;
    template: PromptMessage[] | null;
    temperature: number | null;
    maxTokens: number | null;
    topP: number | null;
    frequencyPenalty: number | null;
    presencePenalty: number | null;
    modelRef: string | null;
}

export interface OverridePayload {
    actionId: ActionId;
    storyId: string | null;
    template?: PromptMessage[] | null;
    temperature?: number | null;
    maxTokens?: number | null;
    topP?: number | null;
    frequencyPenalty?: number | null;
    presencePenalty?: number | null;
    modelRef?: string | null;
}

const fetchJson = async <T>(url: string): Promise<T> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    return response.json();
};

export const useActionRegistry = () =>
    useQuery<ActionDefinition[]>({
        queryKey: ["v2-action-registry"],
        queryFn: () => fetchJson("/api/actions/registry"),
        staleTime: Infinity
    });

export const useOverrides = (storyId: string | null) =>
    useQuery<OverrideRow[]>({
        queryKey: ["v2-action-overrides", storyId ?? "global"],
        queryFn: () => fetchJson(`/api/actions/overrides${storyId ? `?storyId=${storyId}` : ""}`)
    });

export const useSaveOverride = () => {
    const queryClient = useQueryClient();
    return async (payload: OverridePayload): Promise<boolean> => {
        const [error, response] = await attemptPromise(() =>
            fetch("/api/actions/overrides", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })
        );
        if (error || !response?.ok) {
            const body = response ? await response.json().catch(() => ({})) : {};
            toast.error(body.error || "Couldn't save override");
            return false;
        }
        void queryClient.invalidateQueries({ queryKey: ["v2-action-overrides"] });
        toast.success("Override saved");
        return true;
    };
};

export const useResetOverride = () => {
    const queryClient = useQueryClient();
    return async (actionId: ActionId, storyId: string | null): Promise<void> => {
        const [error, response] = await attemptPromise(() =>
            fetch(`/api/actions/overrides/${actionId}${storyId ? `?storyId=${storyId}` : ""}`, { method: "DELETE" })
        );
        if (error || !response?.ok) {
            toast.error("Couldn't reset override");
            return;
        }
        void queryClient.invalidateQueries({ queryKey: ["v2-action-overrides"] });
        toast.success("Reset to built-in");
    };
};

import { useState } from "react";
import type { PromptMessage } from "@/types/story";
import { randomUUID } from "@/utils/crypto";
import { BottomSheet } from "../components/BottomSheet";
import { OverrideParamFields, type OverrideParams } from "./OverrideParamFields";
import { type ActionDefinition, type OverrideRow, useResetOverride, useSaveOverride } from "./useActionOverrides";

/**
 * Advanced-drawer editor for one action's override in one scope. The
 * template is edited as role-tagged blocks; unknown variables are rejected
 * server-side at save (contracts §5) and surfaced here.
 */
export const OverrideEditor = ({
    def,
    override,
    storyId,
    onClose
}: {
    def: ActionDefinition;
    override: OverrideRow | null;
    storyId: string | null;
    onClose: () => void;
}) => {
    const saveOverride = useSaveOverride();
    const resetOverride = useResetOverride();
    // Blocks are added, edited and removed: each carries an id for as long as it's being edited
    const [messages, setMessages] = useState<Array<PromptMessage & { id: string }>>(() =>
        (override?.template ?? def.defaultTemplate).map(message => ({ ...message, id: randomUUID() }))
    );
    const change = (id: string, patch: Partial<PromptMessage>) =>
        setMessages(current => current.map(m => (m.id === id ? { ...m, ...patch } : m)));
    const [params, setParams] = useState<OverrideParams>({
        temperature: override?.temperature ?? def.defaultParams.temperature,
        maxTokens: override?.maxTokens ?? def.defaultParams.maxTokens,
        topP: override?.topP ?? def.defaultParams.topP ?? null,
        frequencyPenalty: override?.frequencyPenalty ?? def.defaultParams.frequencyPenalty ?? null,
        presencePenalty: override?.presencePenalty ?? def.defaultParams.presencePenalty ?? null,
        modelRef: override?.modelRef ?? null
    });

    const save = async () => {
        const ok = await saveOverride({
            actionId: def.id,
            storyId,
            template: messages.map(({ role, content }) => ({ role, content })),
            temperature: params.temperature,
            maxTokens: params.maxTokens,
            topP: params.topP,
            frequencyPenalty: params.frequencyPenalty,
            presencePenalty: params.presencePenalty,
            modelRef: params.modelRef
        });
        if (ok) onClose();
    };

    const reset = async () => {
        await resetOverride(def.id, storyId);
        onClose();
    };

    return (
        <BottomSheet
            title={def.label}
            subtitle={`${storyId ? "This story only" : "All stories"} · variables: ${def.contextNeeds.map(v => `{{${v}}}`).join(" ")}`}
            onClose={onClose}
            bodyClassName="space-y-3 px-4 pb-4"
            footer={
                <>
                    <button
                        type="button"
                        onClick={() => void save()}
                        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
                    >
                        Save override
                    </button>
                    {override && (
                        <button
                            type="button"
                            onClick={() => void reset()}
                            className="rounded-md border px-4 py-2 text-sm"
                        >
                            Reset to built-in
                        </button>
                    )}
                    <button type="button" onClick={onClose} className="ml-auto rounded-md border px-4 py-2 text-sm">
                        Cancel
                    </button>
                </>
            }
        >
            {messages.map(message => (
                <div key={message.id} className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                        <select
                            className="rounded-md border bg-background px-2 py-1"
                            value={message.role}
                            onChange={e => change(message.id, { role: e.target.value as PromptMessage["role"] })}
                        >
                            <option value="system">system</option>
                            <option value="user">user</option>
                            <option value="assistant">assistant</option>
                        </select>
                        <button
                            type="button"
                            className="text-muted-foreground"
                            onClick={() => setMessages(current => current.filter(m => m.id !== message.id))}
                            disabled={messages.length === 1}
                        >
                            remove
                        </button>
                    </div>
                    <textarea
                        className="min-h-24 w-full resize-y rounded-md border bg-background p-2 text-sm"
                        value={message.content}
                        onChange={e => change(message.id, { content: e.target.value })}
                    />
                </div>
            ))}
            <button
                type="button"
                className="rounded-md border px-3 py-1 text-sm"
                onClick={() => setMessages(current => [...current, { role: "user", content: "", id: randomUUID() }])}
            >
                + message
            </button>

            <OverrideParamFields params={params} onChange={setParams} />
        </BottomSheet>
    );
};

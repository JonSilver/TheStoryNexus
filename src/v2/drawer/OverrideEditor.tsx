import { useState } from "react";
import { X } from "lucide-react";
import type { PromptMessage } from "@/types/story";
import { OverrideParamFields, type OverrideParams } from "./OverrideParamFields";
import {
    type ActionDefinition,
    type OverrideRow,
    useResetOverride,
    useSaveOverride
} from "./useActionOverrides";

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
    const [messages, setMessages] = useState<PromptMessage[]>(override?.template ?? def.defaultTemplate);
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
            template: messages,
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
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" role="dialog" aria-label={`Edit ${def.label}`}>
            <div className="flex max-h-[90dvh] flex-col rounded-t-2xl border-t bg-background pb-[env(safe-area-inset-bottom)]">
                <header className="flex items-center justify-between px-4 py-3">
                    <div>
                        <p className="font-medium">{def.label}</p>
                        <p className="text-xs text-muted-foreground">
                            {storyId ? "This story only" : "All stories"} · variables:{" "}
                            {def.contextNeeds.map(v => `{{${v}}}`).join(" ")}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close">
                        <X className="h-4 w-4" />
                    </button>
                </header>

                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4">
                    {messages.map((message, index) => (
                        <div key={index} className="space-y-1">
                            <div className="flex items-center gap-2 text-xs">
                                <select
                                    className="rounded-md border bg-background px-2 py-1"
                                    value={message.role}
                                    onChange={e =>
                                        setMessages(current =>
                                            current.map((m, i) =>
                                                i === index ? { ...m, role: e.target.value as PromptMessage["role"] } : m
                                            )
                                        )
                                    }
                                >
                                    <option value="system">system</option>
                                    <option value="user">user</option>
                                    <option value="assistant">assistant</option>
                                </select>
                                <button
                                    type="button"
                                    className="text-muted-foreground"
                                    onClick={() => setMessages(current => current.filter((_, i) => i !== index))}
                                    disabled={messages.length === 1}
                                >
                                    remove
                                </button>
                            </div>
                            <textarea
                                className="min-h-24 w-full resize-y rounded-md border bg-background p-2 text-sm"
                                value={message.content}
                                onChange={e =>
                                    setMessages(current =>
                                        current.map((m, i) => (i === index ? { ...m, content: e.target.value } : m))
                                    )
                                }
                            />
                        </div>
                    ))}
                    <button
                        type="button"
                        className="rounded-md border px-3 py-1 text-sm"
                        onClick={() => setMessages(current => [...current, { role: "user", content: "" }])}
                    >
                        + message
                    </button>

                    <OverrideParamFields params={params} onChange={setParams} />
                </div>

                <footer className="flex gap-2 border-t p-3">
                    <button
                        type="button"
                        onClick={() => void save()}
                        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
                    >
                        Save override
                    </button>
                    {override && (
                        <button type="button" onClick={() => void reset()} className="rounded-md border px-4 py-2 text-sm">
                            Reset to built-in
                        </button>
                    )}
                    <button type="button" onClick={onClose} className="ml-auto rounded-md border px-4 py-2 text-sm">
                        Cancel
                    </button>
                </footer>
            </div>
        </div>
    );
};

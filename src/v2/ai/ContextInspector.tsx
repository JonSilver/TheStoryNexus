import { attemptPromise } from "@jfdi/attempt";
import { Eye, Loader2, X } from "lucide-react";
import { useState } from "react";
import type { PromptMessage } from "@/types/story";
import type { ActionEditorContext, ActionId } from "./useActionGeneration";

interface PreviewResult {
    model: { provider: string; modelId: string } | null;
    params: { temperature: number; maxTokens: number };
    promptTokens: number;
    messages: PromptMessage[];
}

/**
 * "What I'm sending" (contracts §2, Phase 5): fetches the resolved messages
 * for an action without generating, so the writer can see exactly what
 * context the AI receives.
 */
export const ContextInspector = ({
    actionId,
    storyId,
    chapterId,
    buildEditorContext
}: {
    actionId: ActionId;
    storyId: string;
    chapterId?: string;
    buildEditorContext: () => ActionEditorContext;
}) => {
    const [preview, setPreview] = useState<PreviewResult | "loading" | { error: string } | null>(null);

    const open = async () => {
        setPreview("loading");
        const [error, response] = await attemptPromise(() =>
            fetch("/api/generate/preview", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ actionId, storyId, chapterId, editorContext: buildEditorContext() })
            })
        );
        if (error || !response?.ok) {
            const body = response ? await response.json().catch(() => ({})) : {};
            setPreview({ error: body.error || "Preview failed" });
            return;
        }
        setPreview(await response.json());
    };

    return (
        <>
            <button
                type="button"
                onClick={() => void open()}
                aria-label="What will be sent to the AI?"
                title="What will be sent to the AI?"
                className="ml-auto text-muted-foreground"
            >
                <Eye className="h-4 w-4" />
            </button>
            {preview !== null && (
                <div
                    className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
                    role="dialog"
                    aria-label="Context preview"
                >
                    <div className="flex max-h-[80dvh] flex-col rounded-t-2xl border-t bg-background pb-[env(safe-area-inset-bottom)]">
                        <header className="flex items-center justify-between px-4 py-3">
                            <span className="font-medium">What gets sent</span>
                            <button type="button" onClick={() => setPreview(null)} aria-label="Close">
                                <X className="h-4 w-4" />
                            </button>
                        </header>
                        <div className="min-h-[8rem] flex-1 space-y-3 overflow-y-auto px-4 pb-4 text-xs">
                            {preview === "loading" ? (
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            ) : "error" in preview ? (
                                <p className="text-destructive">{preview.error}</p>
                            ) : (
                                <>
                                    <p className="text-muted-foreground">
                                        {preview.model
                                            ? `${preview.model.provider} / ${preview.model.modelId}`
                                            : "no model configured"}{" "}
                                        · ~{preview.promptTokens} prompt tokens · temp {preview.params.temperature} ·
                                        max {preview.params.maxTokens}
                                    </p>
                                    {preview.messages.map((message, index) => (
                                        <div key={index} className="rounded-md border p-2">
                                            <p className="mb-1 font-semibold uppercase text-muted-foreground">
                                                {message.role}
                                            </p>
                                            <p className="whitespace-pre-wrap">{message.content}</p>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

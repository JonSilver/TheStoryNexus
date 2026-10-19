import { useMutation } from "@tanstack/react-query";
import { Eye, Loader2, X } from "lucide-react";
import { useState } from "react";
import { generateApi, type PromptPreview } from "@/services/api/client";
import type { ActionEditorContext, ActionId } from "./useActionGeneration";

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
    const preview = useMutation({ mutationFn: generateApi.preview });
    const [open, setOpen] = useState(false);
    const show = () => {
        setOpen(true);
        preview.mutate({ actionId, storyId, chapterId, editorContext: buildEditorContext() });
    };

    return (
        <>
            <button
                type="button"
                onClick={show}
                aria-label="What will be sent to the AI?"
                title="What will be sent to the AI?"
                className="ml-auto text-muted-foreground"
            >
                <Eye className="h-4 w-4" />
            </button>
            {open && (
                <div
                    className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
                    role="dialog"
                    aria-label="Context preview"
                >
                    <div className="flex max-h-[80dvh] flex-col rounded-t-2xl border-t bg-background pb-[env(safe-area-inset-bottom)]">
                        <header className="flex items-center justify-between px-4 py-3">
                            <span className="font-medium">What gets sent</span>
                            <button type="button" onClick={() => setOpen(false)} aria-label="Close">
                                <X className="h-4 w-4" />
                            </button>
                        </header>
                        <div className="min-h-[8rem] flex-1 space-y-3 overflow-y-auto px-4 pb-4 text-xs">
                            {preview.isPending ? (
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            ) : preview.isError ? (
                                <p className="text-destructive">{preview.error.message}</p>
                            ) : preview.data ? (
                                <PreviewBody preview={preview.data} />
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

const PreviewBody = ({ preview }: { preview: PromptPreview }) => (
    <>
        <p className="text-muted-foreground">
            {preview.model ? `${preview.model.provider} / ${preview.model.modelId}` : "no model configured"} · ~
            {preview.promptTokens} prompt tokens · temp {preview.params.temperature} · max {preview.params.maxTokens}
        </p>
        {preview.messages.map((message, index) => (
            // Messages are a fixed, ordered list for one render — never reordered
            <div key={index} className="rounded-md border p-2">
                <p className="mb-1 font-semibold uppercase text-muted-foreground">{message.role}</p>
                <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
        ))}
    </>
);

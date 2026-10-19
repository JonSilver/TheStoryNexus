import { useMutation } from "@tanstack/react-query";
import { Eye, Loader2 } from "lucide-react";
import { useState } from "react";
import { generateApi, type PromptPreview } from "@/services/api/client";
import { BottomSheet } from "../components/BottomSheet";
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
                <BottomSheet
                    title="What gets sent"
                    onClose={() => setOpen(false)}
                    bodyClassName="min-h-[8rem] space-y-3 px-4 pb-4 text-xs"
                >
                    {preview.isPending ? (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : preview.isError ? (
                        <p className="text-destructive">{preview.error.message}</p>
                    ) : preview.data ? (
                        <PreviewBody preview={preview.data} />
                    ) : null}
                </BottomSheet>
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

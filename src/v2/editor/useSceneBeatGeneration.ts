import { useCallback, useEffect, useRef } from "react";
import {
    $getNodeByKey,
    $getRoot,
    $setState,
    HISTORY_MERGE_TAG,
    HISTORY_PUSH_TAG,
    SKIP_SCROLL_INTO_VIEW_TAG,
    type NodeKey,
    type UpdateTag
} from "lexical";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { attemptPromise } from "@jfdi/attempt";
import { toast } from "react-toastify";
import { createSSEParser } from "@/services/ai/sseParser";
import { useChapterIdentity } from "./ChapterContext";
import { generatedTextState, $isSceneBeatNode, type SceneBeatNode, statusState } from "./nodes/SceneBeatNode";

const RECENT_PROSE_CHAR_CAP = 100_000;

/**
 * Streams the scene_beat action into the node's own state — durable per
 * token, kept out of the undo stack via the history-merge tag (as an ARRAY;
 * spike finding), behind a HISTORY_PUSH boundary so merges can't attach to
 * prior edits. Abort on stop, delete, or unmount.
 */
export const useSceneBeatGeneration = (nodeKey: NodeKey) => {
    const [editor] = useLexicalComposerContext();
    const { storyId, chapterId } = useChapterIdentity();
    const cancelRef = useRef<(() => void) | null>(null);

    const mutate = useCallback(
        (fn: (node: SceneBeatNode) => void, tag: UpdateTag | UpdateTag[]) =>
            editor.update(
                () => {
                    const node = $getNodeByKey(nodeKey);
                    if ($isSceneBeatNode(node)) fn(node);
                },
                { tag }
            ),
        [editor, nodeKey]
    );

    useEffect(() => () => cancelRef.current?.(), []);

    const textBeforeNode = useCallback(
        () =>
            editor
                .getEditorState()
                .read(() => {
                    const pieces: string[] = [];
                    for (const child of $getRoot().getChildren()) {
                        if (child.getKey() === nodeKey) break;
                        pieces.push(child.getTextContent());
                    }
                    return pieces.join("\n\n");
                })
                .slice(-RECENT_PROSE_CHAR_CAP),
        [editor, nodeKey]
    );

    const generate = useCallback(
        async (command: string) => {
            cancelRef.current?.();
            const requestId = crypto.randomUUID();
            const controller = new AbortController();
            const cancel = () => {
                controller.abort();
                void attemptPromise(() =>
                    fetch("/api/generate/abort", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ requestId })
                    })
                );
            };
            cancelRef.current = cancel;
            // Superseded runs must neither mutate the node nor clear the
            // successor's cancel handle
            const owns = () => cancelRef.current === cancel;

            mutate(node => {
                $setState(node, statusState, "generating");
                $setState(node, generatedTextState, "");
            }, HISTORY_PUSH_TAG);

            const finish = (errorMessage?: string) => {
                if (!owns()) return;
                cancelRef.current = null;
                mutate(node => $setState(node, statusState, "done"), HISTORY_MERGE_TAG);
                if (errorMessage) toast.error(errorMessage);
            };

            const [fetchError, response] = await attemptPromise(() =>
                fetch("/api/generate/action", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        requestId,
                        actionId: "scene_beat",
                        storyId,
                        chapterId,
                        editorContext: { command, recentProse: textBeforeNode() }
                    }),
                    signal: controller.signal
                })
            );
            if (fetchError || !response) {
                finish((fetchError as Error)?.name === "AbortError" ? undefined : ((fetchError as Error)?.message ?? "Request failed"));
                return;
            }
            if (!response.ok || !response.body) {
                const body = await response.json().catch(() => ({}));
                finish(body.error || `Generation failed (${response.status})`);
                return;
            }

            const parser = createSSEParser({
                onToken: token => {
                    if (!owns()) return;
                    mutate(
                        node => $setState(node, generatedTextState, prev => prev + token),
                        [HISTORY_MERGE_TAG, SKIP_SCROLL_INTO_VIEW_TAG]
                    );
                },
                onComplete: () => finish(),
                onError: error => finish(error.message)
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            const [readError] = await attemptPromise(async () => {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        parser.push(decoder.decode());
                        parser.end();
                        break;
                    }
                    parser.push(decoder.decode(value, { stream: true }));
                }
            });
            if (readError && (readError as Error).name === "AbortError") finish();
        },
        [mutate, storyId, chapterId, textBeforeNode]
    );

    const stop = useCallback(() => {
        cancelRef.current?.();
        cancelRef.current = null;
    }, []);

    return { generate, stop, mutate, textBeforeNode, abortActive: () => cancelRef.current?.() };
};

import { attemptPromise } from "@jfdi/attempt";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
    $getNodeByKey,
    $getRoot,
    $getState,
    $setState,
    HISTORY_MERGE_TAG,
    HISTORY_PUSH_TAG,
    SKIP_SCROLL_INTO_VIEW_TAG,
    type NodeKey,
    type UpdateTag
} from "lexical";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { createSSEParser, type GenerationStatus } from "@/services/ai/sseParser";
import { randomUUID } from "@/utils/crypto";
import { describeRequestFailure, describeStreamFailure } from "../ai/requestFailure";
import { useChapterIdentity } from "./ChapterContext";
import {
    $commitStreamingAsTake,
    $isSceneBeatNode,
    povCharacterState,
    povTypeState,
    type SceneBeatNode,
    statusState,
    streamingState
} from "./nodes/SceneBeatNode";

const RECENT_PROSE_CHAR_CAP = 100_000;

/**
 * Streams the scene_beat action into the node's streaming field — previous
 * takes are NEVER touched, so a failed or unwanted generation costs nothing.
 * On completion (including a partial kept via Stop) the streamed text is
 * appended as a new take and selected. Legacy single-draft beats fold their
 * old generatedText in as take one. Streaming stays out of undo history
 * (history-merge tag as an ARRAY) behind a HISTORY_PUSH boundary.
 */
export const useSceneBeatGeneration = (nodeKey: NodeKey) => {
    const [editor] = useLexicalComposerContext();
    const { storyId, chapterId } = useChapterIdentity();
    const cancelRef = useRef<(() => void) | null>(null);
    // Waiting phase + elapsed from the server, for the beat's progress line
    const [progress, setProgress] = useState<GenerationStatus | null>(null);

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
        async (command: string, guidance?: string) => {
            // A superseded run's partial becomes a take before the new run
            // clears the stream — no generation is ever lost
            if (cancelRef.current) {
                cancelRef.current();
                cancelRef.current = null;
                mutate(node => $commitStreamingAsTake(node, true), HISTORY_MERGE_TAG);
            }
            const requestId = randomUUID();
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
            const owns = () => cancelRef.current === cancel;

            // The beat's own POV wins over the chapter default — the picker
            // must actually steer generation, not just persist state
            const pov = editor.getEditorState().read(() => {
                const node = $getNodeByKey(nodeKey);
                if (!$isSceneBeatNode(node)) return {};
                const povCharacter = $getState(node, povCharacterState);
                const povType = $getState(node, povTypeState);
                return {
                    ...(povCharacter ? { povCharacter } : {}),
                    ...(povType ? { povType } : {})
                };
            });

            mutate(node => {
                $setState(node, statusState, "generating");
                $setState(node, streamingState, "");
            }, HISTORY_PUSH_TAG);

            // Completion commits the streamed text (if any) as a NEW take;
            // failure with nothing streamed restores the pre-generation view
            const finish = (errorMessage?: string, stopped = false) => {
                if (!owns()) return;
                cancelRef.current = null;
                // A take cut short (failure or Stop) is kept, and marked so it can't pass for a finished one
                mutate(node => $commitStreamingAsTake(node, Boolean(errorMessage) || stopped), HISTORY_MERGE_TAG);
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
                        editorContext: {
                            command,
                            recentProse: textBeforeNode(),
                            ...pov,
                            ...(guidance?.trim() ? { guidance: guidance.trim() } : {})
                        }
                    }),
                    signal: controller.signal
                })
            );
            if (fetchError || !response) {
                finish((fetchError as Error)?.name === "AbortError" ? undefined : describeRequestFailure(fetchError));
                return;
            }
            if (!response.ok || !response.body) {
                const body = await response.json().catch(() => ({}));
                finish(body.error || `Generation failed (${response.status})`);
                return;
            }

            const parser = createSSEParser({
                onStatus: next => {
                    if (owns()) setProgress(next);
                },
                onToken: token => {
                    if (!owns()) return;
                    mutate(
                        node => $setState(node, streamingState, prev => prev + token),
                        [HISTORY_MERGE_TAG, SKIP_SCROLL_INTO_VIEW_TAG]
                    );
                },
                onComplete: () => finish(),
                onAborted: () => finish(undefined, true),
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
            if (readError)
                if ((readError as Error).name === "AbortError") finish(undefined, true);
                else finish(describeStreamFailure(readError));
        },
        [mutate, editor, nodeKey, storyId, chapterId, textBeforeNode]
    );

    const stop = useCallback(() => {
        // Abort only — the run still owns cancelRef and commits the partial
        cancelRef.current?.();
    }, []);

    const abortActive = useCallback(() => cancelRef.current?.(), []);
    const ownsRun = useCallback(() => cancelRef.current !== null, []);

    return { generate, stop, mutate, textBeforeNode, abortActive, ownsRun, progress };
};

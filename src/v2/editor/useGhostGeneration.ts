import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
    $getNodeByKey,
    $setState,
    HISTORY_MERGE_TAG,
    SKIP_SCROLL_INTO_VIEW_TAG,
    type NodeKey,
    type UpdateTag
} from "lexical";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GenerationStatus } from "@/services/ai/sseParser";
import { streamAction } from "../ai/streamAction";
import { useAttempts } from "../ai/useAttempts";
import { useChapterIdentity } from "./ChapterContext";
import { $textBefore } from "./lexicalText";
import {
    type GhostSuggestionNode,
    ghostStatusState,
    $isGhostSuggestionNode,
    $readGhost,
    $setGhostText,
    takeFreshGhostFlag
} from "./nodes/GhostSuggestionNode";

/**
 * A ghost continuation's generation: streams into the node, keeps every
 * continuation as an attempt (runtime only), and on failure keeps the ghost
 * with what arrived — or the continuation shown before — to try again.
 */
export const useGhostGeneration = (nodeKey: NodeKey) => {
    const [editor] = useLexicalComposerContext();
    const { storyId, chapterId } = useChapterIdentity();
    const attempts = useAttempts();
    const { record, recordIfNew } = attempts;
    const [status, setStatus] = useState<GenerationStatus | null>(null);
    const [failure, setFailure] = useState<{ message: string; keptPartial: boolean } | null>(null);
    const run = useRef<{ abort: () => void; stopped: boolean } | null>(null);
    const lastGuidance = useRef<string | undefined>(undefined);

    const updateGhost = useCallback(
        (change: (node: GhostSuggestionNode) => void, tag?: UpdateTag | UpdateTag[]) =>
            editor.update(
                () => {
                    const node = $getNodeByKey(nodeKey);
                    if ($isGhostSuggestionNode(node)) change(node);
                },
                tag ? { tag } : undefined
            ),
        [editor, nodeKey]
    );

    const generate = useCallback(
        (guidance?: string) => {
            run.current?.abort();
            lastGuidance.current = guidance;
            setFailure(null);
            const { onScreen, recentProse } = editor.getEditorState().read(() => {
                const node = $getNodeByKey(nodeKey);
                return {
                    onScreen: $isGhostSuggestionNode(node) ? $readGhost(node).text : "",
                    recentProse: $textBefore(nodeKey)
                };
            });
            // A continuation already showing (e.g. after a reload, where attempts start empty) is kept first
            recordIfNew(onScreen);
            updateGhost(node => {
                $setState(node, ghostStatusState, "streaming");
                $setGhostText(node, "");
            });
            const thisRun = { abort: () => {}, stopped: false };
            run.current = thisRun;
            const produced = { text: "" };
            thisRun.abort = streamAction(
                {
                    actionId: "continue",
                    storyId,
                    chapterId,
                    editorContext: { recentProse, ...(guidance ? { guidance } : {}) }
                },
                {
                    onStatus: next => {
                        if (run.current === thisRun) setStatus(next);
                    },
                    onToken: token => {
                        if (run.current !== thisRun) return;
                        produced.text += token;
                        updateGhost(
                            node => $setGhostText(node, prev => prev + token),
                            [HISTORY_MERGE_TAG, SKIP_SCROLL_INTO_VIEW_TAG]
                        );
                    },
                    onDone: error => {
                        // A superseded run's late completion must not touch its successor
                        if (run.current !== thisRun) return;
                        run.current = null;
                        setStatus(null);
                        const got = produced.text.trim() !== "";
                        record(produced.text);
                        // A Stop before any text is the writer's choice, not a failure
                        const stoppedEmpty = !error && !got && thisRun.stopped;
                        if (!stoppedEmpty && (error || !got))
                            setFailure({ message: error ?? "The model returned nothing.", keptPartial: got });
                        const fallback = got || !onScreen.trim() ? null : onScreen;
                        updateGhost(node => {
                            // Stopped with nothing to show and nothing earlier: no ghost left behind
                            if (stoppedEmpty && fallback === null) return void node.remove();
                            $setState(node, ghostStatusState, "done");
                            if (fallback !== null) $setGhostText(node, fallback);
                        }, HISTORY_MERGE_TAG);
                    }
                }
            ).abort;
        },
        [editor, nodeKey, storyId, chapterId, record, recordIfNew, updateGhost]
    );

    const stop = () => {
        if (!run.current) return;
        run.current.stopped = true;
        run.current.abort();
    };

    const showAttempt = (index: number) => {
        const chosen = attempts.at(index);
        if (chosen === null) return;
        attempts.select(index);
        updateGhost(node => $setGhostText(node, chosen), HISTORY_MERGE_TAG);
    };

    // The run lives here, with the ghost it fills, so the wand's handoff is the
    // one-shot freshness marker read on first mount. Any other ghost without a
    // run — rehydrated, or undo-revived mid-stream — is an orphan: partial text
    // settles into a reviewable suggestion, empty stubs go, nothing generates.
    useEffect(() => {
        if (takeFreshGhostFlag(nodeKey)) generate();
        else
            updateGhost(node => {
                const { text, ghostStatus } = $readGhost(node);
                if (!text.trim()) node.remove();
                else if (ghostStatus === "streaming") $setState(node, ghostStatusState, "done");
            }, HISTORY_MERGE_TAG);
        return () => run.current?.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        status,
        failure,
        attempts: { count: attempts.count, index: attempts.index },
        generate,
        again: () => generate(lastGuidance.current),
        stop,
        showAttempt
    };
};

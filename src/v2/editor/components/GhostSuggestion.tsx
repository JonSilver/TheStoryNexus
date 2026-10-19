import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
    $createParagraphNode,
    $createTextNode,
    $getNodeByKey,
    $getRoot,
    $setState,
    HISTORY_MERGE_TAG,
    HISTORY_PUSH_TAG,
    SKIP_SCROLL_INTO_VIEW_TAG,
    type LexicalNode,
    type NodeKey
} from "lexical";
import { Check, CornerDownRight, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import type { GenerationStatus } from "@/services/ai/sseParser";
import { GenerationProgress } from "../../ai/GenerationProgress";
import { streamAction } from "../../ai/streamAction";
import { useChapterIdentity } from "../ChapterContext";
import {
    ghostStatusState,
    $isGhostSuggestionNode,
    $readGhost,
    $setGhostText,
    takeFreshGhostFlag
} from "../nodes/GhostSuggestionNode";
import { useGhostData } from "../useGhostData";

/**
 * The inline provisional continuation: greyed prose in the manuscript with
 * Keep / Refine / Dismiss. Judging the continuation happens in the prose,
 * not in a modal over it.
 */
export const GhostSuggestion = ({ nodeKey }: { nodeKey: NodeKey }) => {
    const [editor] = useLexicalComposerContext();
    const { storyId, chapterId } = useChapterIdentity();
    const { text, ghostStatus } = useGhostData(nodeKey);
    const [refineText, setRefineText] = useState("");
    const [status, setStatus] = useState<GenerationStatus | null>(null);
    const abortRef = useRef<(() => void) | null>(null);
    const startedRef = useRef(false);

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
                .slice(-100_000),
        [editor, nodeKey]
    );

    const generate = useCallback(
        (guidance?: string) => {
            abortRef.current?.();
            editor.update(() => {
                const node = $getNodeByKey(nodeKey);
                if (!$isGhostSuggestionNode(node)) return;
                $setState(node, ghostStatusState, "streaming");
                $setGhostText(node, "");
            });
            const handle = streamAction(
                {
                    actionId: "continue",
                    storyId,
                    chapterId,
                    editorContext: {
                        recentProse: textBeforeNode(),
                        ...(guidance ? { guidance } : {})
                    }
                },
                {
                    onStatus: setStatus,
                    onToken: token =>
                        editor.update(
                            () => {
                                const node = $getNodeByKey(nodeKey);
                                if ($isGhostSuggestionNode(node)) $setGhostText(node, prev => prev + token);
                            },
                            { tag: [HISTORY_MERGE_TAG, SKIP_SCROLL_INTO_VIEW_TAG] }
                        ),
                    onDone: error => {
                        abortRef.current = null;
                        setStatus(null);
                        editor.update(
                            () => {
                                const node = $getNodeByKey(nodeKey);
                                if (!$isGhostSuggestionNode(node)) return;
                                $setState(node, ghostStatusState, "done");
                                // Nothing arrived and nothing to show: clear the ghost
                                if (!$readGhost(node).text.trim()) node.remove();
                            },
                            { tag: HISTORY_MERGE_TAG }
                        );
                        if (error) toast.error(error);
                    }
                }
            );
            abortRef.current = handle.abort;
        },
        [editor, nodeKey, storyId, chapterId, textBeforeNode]
    );

    // Auto-start ONLY for a ghost created this session (one-shot runtime
    // marker). Anything else without an owning run — a rehydrated ghost, an
    // undo-revived one still marked streaming — is an orphan: settle partial
    // text into a reviewable suggestion, remove empty stubs, never generate.
    useEffect(() => {
        if (startedRef.current) return;
        startedRef.current = true;
        if (takeFreshGhostFlag(nodeKey)) generate();
        else if (ghostStatus === "streaming" || !text.trim())
            editor.update(
                () => {
                    const node = $getNodeByKey(nodeKey);
                    if (!$isGhostSuggestionNode(node)) return;
                    if ($readGhost(node).text.trim()) $setState(node, ghostStatusState, "done");
                    else node.remove();
                },
                { tag: HISTORY_MERGE_TAG }
            );
        return () => abortRef.current?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const keep = () =>
        editor.update(
            () => {
                const node = $getNodeByKey(nodeKey);
                if (!$isGhostSuggestionNode(node)) return;
                const paragraphs = $readGhost(node)
                    .text.split(/\n{2,}/)
                    .map(p => p.trim())
                    .filter(Boolean)
                    .map(p => {
                        const paragraph = $createParagraphNode();
                        paragraph.append($createTextNode(p));
                        return paragraph;
                    });
                paragraphs.reduce<LexicalNode>((prev, p) => {
                    prev.insertAfter(p);
                    return p;
                }, node);
                node.remove();
                paragraphs[paragraphs.length - 1]?.selectEnd();
            },
            { tag: HISTORY_PUSH_TAG }
        );

    const dismiss = () => {
        abortRef.current?.();
        editor.update(() => {
            const node = $getNodeByKey(nodeKey);
            if ($isGhostSuggestionNode(node)) node.remove();
        });
    };

    const refine = () => {
        if (!refineText.trim()) return;
        generate(refineText.trim());
        setRefineText("");
    };

    const streaming = ghostStatus === "streaming";

    return (
        <div className="my-2 border-l-2 border-primary/40 pl-3" data-ghost>
            <div className="whitespace-pre-wrap italic leading-relaxed text-muted-foreground">
                {text || (
                    <GenerationProgress status={status ?? { phase: "waiting", elapsedMs: 0 }} className="not-italic" />
                )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                {streaming ? (
                    <button type="button" onClick={() => abortRef.current?.()} className="rounded-md border px-3 py-1">
                        Stop
                    </button>
                ) : (
                    text && (
                        <>
                            <button
                                type="button"
                                onClick={keep}
                                className="flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-primary-foreground"
                            >
                                <Check className="h-4 w-4" /> Keep
                            </button>
                            <button
                                type="button"
                                onClick={dismiss}
                                className="flex items-center gap-1 rounded-md border px-3 py-1"
                            >
                                <X className="h-4 w-4" /> Dismiss
                            </button>
                            <input
                                className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1"
                                maxLength={5000}
                                placeholder="Refine…"
                                value={refineText}
                                onChange={e => setRefineText(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && refine()}
                            />
                            <button
                                type="button"
                                onClick={refine}
                                disabled={!refineText.trim()}
                                aria-label="Refine continuation"
                                className="rounded-md border px-2 py-1 disabled:opacity-50"
                            >
                                <CornerDownRight className="h-4 w-4" />
                            </button>
                        </>
                    )
                )}
            </div>
        </div>
    );
};

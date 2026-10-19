import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
    $getNodeByKey,
    $getRoot,
    $setState,
    HISTORY_MERGE_TAG,
    HISTORY_PUSH_TAG,
    SKIP_SCROLL_INTO_VIEW_TAG,
    type NodeKey
} from "lexical";
import { Check, CornerDownRight, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GenerationStatus } from "@/services/ai/sseParser";
import { GenerationProgress } from "../../ai/GenerationProgress";
import { streamAction } from "../../ai/streamAction";
import { useChapterIdentity } from "../ChapterContext";
import { $insertParagraphsAfter } from "../lexicalText";
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
    // Runtime-only: earlier continuations to flip back to, and the last failure
    const [attempts, setAttemptsState] = useState<{ list: string[]; index: number }>({ list: [], index: 0 });
    const attemptsRef = useRef(attempts);
    const setAttempts = (next: { list: string[]; index: number }) => {
        attemptsRef.current = next;
        setAttemptsState(next);
    };
    const [failure, setFailure] = useState<string | null>(null);
    const lastGuidance = useRef<string | undefined>(undefined);
    const streamed = useRef("");
    const abortRef = useRef<(() => void) | null>(null);
    const startedRef = useRef(false);
    const runRef = useRef<symbol | null>(null);
    const stoppedRef = useRef(false);

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
            const run = Symbol("ghost-run");
            runRef.current = run;
            stoppedRef.current = false;
            lastGuidance.current = guidance;
            streamed.current = "";
            setFailure(null);
            // A continuation already on screen (e.g. after a reload, where the
            // attempt list starts empty) becomes an attempt before it's cleared
            const onScreen = editor.getEditorState().read(() => {
                const node = $getNodeByKey(nodeKey);
                return $isGhostSuggestionNode(node) ? $readGhost(node).text : "";
            });
            const known = attemptsRef.current;
            if (onScreen.trim() && !known.list.includes(onScreen))
                setAttempts({ list: [...known.list, onScreen], index: known.list.length });
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
                    onStatus: next => {
                        if (runRef.current === run) setStatus(next);
                    },
                    onToken: token => {
                        if (runRef.current !== run) return;
                        streamed.current += token;
                        editor.update(
                            () => {
                                const node = $getNodeByKey(nodeKey);
                                if ($isGhostSuggestionNode(node)) $setGhostText(node, prev => prev + token);
                            },
                            { tag: [HISTORY_MERGE_TAG, SKIP_SCROLL_INTO_VIEW_TAG] }
                        );
                    },
                    onDone: error => {
                        // A superseded run's late completion must not touch its successor
                        if (runRef.current !== run) return;
                        abortRef.current = null;
                        setStatus(null);
                        const produced = streamed.current;
                        const previous = attemptsRef.current;
                        if (produced.trim())
                            setAttempts({ list: [...previous.list, produced], index: previous.list.length });
                        const stoppedEmpty = !error && !produced.trim() && stoppedRef.current;
                        // A failure keeps the ghost (with Try again) instead of
                        // vanishing; a Stop before any text is the writer's choice, not a failure
                        if (!stoppedEmpty && (error || !produced.trim()))
                            setFailure(error ?? "The model returned nothing.");
                        const fallback = produced.trim() ? null : (previous.list[previous.index] ?? null);
                        editor.update(
                            () => {
                                const node = $getNodeByKey(nodeKey);
                                if (!$isGhostSuggestionNode(node)) return;
                                // Stopped with nothing to show and nothing earlier: no ghost left behind
                                if (stoppedEmpty && fallback === null) return node.remove();
                                $setState(node, ghostStatusState, "done");
                                if (fallback !== null) $setGhostText(node, fallback);
                            },
                            { tag: HISTORY_MERGE_TAG }
                        );
                    }
                }
            );
            abortRef.current = handle.abort;
        },
        [editor, nodeKey, storyId, chapterId, textBeforeNode]
    );

    const showAttempt = (index: number) => {
        const chosen = attempts.list[index];
        if (chosen === undefined) return;
        setAttempts({ ...attemptsRef.current, index });
        editor.update(
            () => {
                const node = $getNodeByKey(nodeKey);
                if ($isGhostSuggestionNode(node)) $setGhostText(node, chosen);
            },
            { tag: HISTORY_MERGE_TAG }
        );
    };

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
                $insertParagraphsAfter(node, $readGhost(node).text);
                node.remove();
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

    const again = () => generate(lastGuidance.current);

    return (
        <div className="my-2 border-l-2 border-primary/40 pl-3" data-ghost>
            {failure && !streaming && (
                <p className="mb-1 text-sm not-italic text-destructive" role="alert">
                    {failure}
                    {text &&
                        (streamed.current.trim()
                            ? " What arrived is kept below."
                            : " Your earlier continuation is still here.")}
                </p>
            )}
            <div className="whitespace-pre-wrap italic leading-relaxed text-muted-foreground">
                {text}
                {streaming && (
                    <GenerationProgress
                        status={status ?? { phase: "waiting", elapsedMs: 0 }}
                        className={`not-italic ${text ? "mt-1" : ""}`}
                    />
                )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                {streaming ? (
                    <button
                        type="button"
                        onClick={() => {
                            stoppedRef.current = true;
                            abortRef.current?.();
                        }}
                        className="rounded-md border px-3 py-1"
                    >
                        Stop
                    </button>
                ) : (
                    <>
                        {text && (
                            <button
                                type="button"
                                onClick={keep}
                                className="flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-primary-foreground"
                            >
                                <Check className="h-4 w-4" /> Keep
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={again}
                            className="flex items-center gap-1 rounded-md border px-3 py-1"
                        >
                            <RotateCcw className="h-4 w-4" /> {text ? "Again" : "Try again"}
                        </button>
                        <button
                            type="button"
                            onClick={dismiss}
                            className="flex items-center gap-1 rounded-md border px-3 py-1"
                        >
                            <X className="h-4 w-4" /> Dismiss
                        </button>
                        {attempts.list.length > 1 && (
                            <span className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => showAttempt(attempts.index - 1)}
                                    disabled={attempts.index === 0}
                                    aria-label="Previous continuation"
                                    className="rounded-md border px-2 py-0.5 disabled:opacity-40"
                                >
                                    ‹
                                </button>
                                <span className="text-xs text-muted-foreground">
                                    {attempts.index + 1}/{attempts.list.length}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => showAttempt(attempts.index + 1)}
                                    disabled={attempts.index === attempts.list.length - 1}
                                    aria-label="Next continuation"
                                    className="rounded-md border px-2 py-0.5 disabled:opacity-40"
                                >
                                    ›
                                </button>
                            </span>
                        )}
                        {text && (
                            <>
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
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

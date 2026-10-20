import { attemptPromise } from "@jfdi/attempt";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useQueryClient } from "@tanstack/react-query";
import {
    $getRoot,
    $getSelection,
    $isRangeSelection,
    $setSelection,
    HISTORY_PUSH_TAG,
    type RangeSelection
} from "lexical";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useUpdateChapterMutation } from "@/features/chapters/hooks/useChaptersQuery";
import { chaptersApi } from "@/services/api/client";
import { chaptersKeys } from "@/services/api/queryKeys";
import type { Chapter } from "@/types/story";
import { $appendParagraphs, $captureSelection, $replaceSelectionWithProse, $textBefore } from "../editor/lexicalText";
import { $createGhostSuggestionNode } from "../editor/nodes/GhostSuggestionNode";
import { flushChapterSave } from "../editor/useChapterSaver";
import { checkReply, type ReplyAction } from "./replyCheck";
import { SELECTION_ACTIONS, type SelectionActionId } from "./selectionActions";
import { type ActionId, useActionGeneration } from "./useActionGeneration";
import { useAttempts } from "./useAttempts";

type ActionKind = "selection" | "continue" | "summarise" | "ask";

interface ActiveAction {
    id: ActionId;
    title: string;
    kind: ActionKind;
}

const ACCEPT_LABELS: Record<ActionKind, string> = {
    selection: "Replace selection",
    continue: "Insert",
    summarise: "Save summary",
    ask: "Replace selection"
};

/**
 * Wires the built-in AI actions (contracts Phase 4) to the editor: selection
 * actions and Continue stream into a preview sheet and only touch the
 * document on Accept; Summarise saves the chapter summary with its source
 * revision for freshness tracking.
 */

export const useEditorActions = (chapter: Chapter) => {
    const [editor] = useLexicalComposerContext();
    const queryClient = useQueryClient();
    const updateChapter = useUpdateChapterMutation();
    const generation = useActionGeneration();
    const [active, setActive] = useState<ActiveAction | null>(null);
    const savedSelection = useRef<RangeSelection | null>(null);
    const savedSelectionText = useRef<string>("");
    const summariseBaseRevision = useRef<number | null>(null);
    const lastRun = useRef<{ actionId: ActionId; editorContext: Record<string, string> } | null>(null);
    const [askPending, setAskPending] = useState(false);
    const attempts = useAttempts();
    // Stable members only in callback deps — the hook objects themselves are new every render
    const { record, clear: clearAttempts } = attempts;
    const { run: runGeneration, reset: resetGeneration } = generation;

    // Every run that produced text is kept as an attempt — a failure keeps
    // what arrived as a partial one — so nothing the model wrote is lost
    const runAttempt = useCallback(
        (actionId: ActionId, editorContext?: Record<string, string>) => {
            lastRun.current = { actionId, editorContext: editorContext ?? {} };
            void runGeneration({ actionId, storyId: chapter.storyId, chapterId: chapter.id, editorContext }).then(
                result => {
                    if (result.outcome !== "superseded") record(result.text, result.outcome !== "complete");
                }
            );
        },
        [runGeneration, chapter.storyId, chapter.id, record]
    );

    const docTextTail = useCallback(() => editor.getEditorState().read(() => $textBefore(null)), [editor]);

    const baseContext = useCallback(
        // DB nulls must not reach the API's string validators
        () => ({
            ...(chapter.povCharacter ? { povCharacter: chapter.povCharacter } : {}),
            ...(chapter.povType ? { povType: chapter.povType as string } : {})
        }),
        [chapter.povCharacter, chapter.povType]
    );

    /** Holds the writer's selection for the sheet to act on later; false (and says so) when there's none. */
    const holdSelection = useCallback(() => {
        const captured = editor.getEditorState().read($captureSelection);
        if (!captured) {
            toast.info("Select some text first");
            return false;
        }
        savedSelection.current = captured.selection;
        savedSelectionText.current = captured.text;
        clearAttempts();
        return true;
    }, [editor, clearAttempts]);

    const onSelectionAction = useCallback(
        (actionId: SelectionActionId) => {
            if (!holdSelection()) return;
            const { label } = SELECTION_ACTIONS.find(action => action.actionId === actionId) ?? { label: actionId };
            setActive({ id: actionId, title: label, kind: "selection" });
            runAttempt(actionId, {
                ...baseContext(),
                selection: savedSelectionText.current,
                recentProse: docTextTail()
            });
        },
        [holdSelection, runAttempt, baseContext, docTextTail]
    );

    // Free-form instruction on a selection: capture first, ask the writer
    // what to do, then run the ask action with their instruction
    const onAsk = useCallback(() => {
        if (!holdSelection()) return;
        setActive({ id: "ask", title: "Ask about this passage", kind: "ask" });
        setAskPending(true);
    }, [holdSelection]);

    const submitAsk = useCallback(
        (instruction: string) => {
            setAskPending(false);
            runAttempt("ask", {
                ...baseContext(),
                selection: savedSelectionText.current,
                recentProse: docTextTail(),
                userMessage: instruction
            });
        },
        [runAttempt, baseContext, docTextTail]
    );

    const onRefine = useCallback(
        (guidance: string) => {
            const previous = lastRun.current;
            if (!previous) return;
            runAttempt(previous.actionId, { ...previous.editorContext, guidance });
        },
        [runAttempt]
    );

    // Same request again — for a failure, or a result that isn't good enough
    const onAgain = useCallback(() => {
        const previous = lastRun.current;
        if (previous) runAttempt(previous.actionId, previous.editorContext);
    }, [runAttempt]);

    // Continue is inline now: a ghost suggestion node streams greyed prose
    // in the manuscript itself (W2) — no modal, judged in place
    const onContinue = useCallback(() => {
        editor.update(() => {
            const selection = $getSelection();
            const anchorBlock = $isRangeSelection(selection) ? selection.anchor.getNode().getTopLevelElement() : null;
            const ghost = $createGhostSuggestionNode();
            if (anchorBlock) anchorBlock.insertAfter(ghost);
            else $getRoot().append(ghost);
        });
    }, [editor]);

    // Each sheet session; Discard ends it, so work it started late (after a save flush, say) never runs
    const session = useRef(0);

    const onSummarise = useCallback(() => {
        clearAttempts();
        setActive({ id: "summarise_chapter", title: "Summarise chapter", kind: "summarise" });
        const mine = ++session.current;
        void (async () => {
            // The model must see what the writer sees: force the debounced
            // save down before the server reads the chapter
            await flushChapterSave(chapter.id);
            // Freshness is anchored to the revision the summary was GENERATED
            // from, not whatever revision exists when it is accepted
            const [, fresh] = await attemptPromise(() =>
                queryClient.fetchQuery({
                    queryKey: chaptersKeys.detail(chapter.id),
                    queryFn: () => chaptersApi.getById(chapter.id),
                    staleTime: 0
                })
            );
            if (session.current !== mine) return;
            summariseBaseRevision.current = fresh?.revision ?? chapter.revision ?? 0;
            runAttempt("summarise_chapter");
        })();
    }, [clearAttempts, runAttempt, chapter.id, chapter.revision, queryClient]);

    const close = useCallback(() => {
        session.current += 1;
        setActive(null);
        setAskPending(false);
        savedSelection.current = null;
        lastRun.current = null;
        clearAttempts();
        resetGeneration();
    }, [resetGeneration, clearAttempts]);

    const { mutate: updateChapterMutate } = updateChapter;
    const saveSummary = useCallback(
        (summary: string) => {
            const sourceRevision = summariseBaseRevision.current;
            if (sourceRevision === null) {
                toast.error("Couldn't save summary");
                return;
            }
            updateChapterMutate(
                { id: chapter.id, data: { summary, summarySourceRevision: sourceRevision, summaryLocked: false } },
                { onSuccess: () => toast.success("Summary saved") }
            );
        },
        [chapter.id, updateChapterMutate]
    );

    // The attempt the writer is looking at, not necessarily the latest
    const shown = attempts.current;
    const onAccept = useCallback(() => {
        const kind = active?.kind;
        const text = shown;
        if (!kind || !text) return;

        if (kind === "selection" || kind === "ask")
            editor.update(
                () => {
                    const saved = savedSelection.current;
                    if (saved) $setSelection(saved.clone());
                    const selection = $getSelection();
                    if ($isRangeSelection(selection)) $replaceSelectionWithProse(selection, text);
                },
                { tag: HISTORY_PUSH_TAG }
            );
        else if (kind === "continue") editor.update(() => $appendParagraphs(text), { tag: HISTORY_PUSH_TAG });
        else saveSummary(text);

        close();
    }, [active, shown, editor, close, saveSummary]);

    const toolbarActions = useMemo(
        () => ({ onContinue, onSummarise, onSelectionAction, onAsk }),
        [onContinue, onSummarise, onSelectionAction, onAsk]
    );

    // A replacement that looks like more than the passage is called out, never trimmed silently
    const shownReply = generation.phase === "streaming" ? null : attempts.current;
    const replyAction = active && active.kind !== "summarise" ? (active.id as ReplyAction) : null;
    const check = shownReply && replyAction ? checkReply(replyAction, savedSelectionText.current, shownReply) : null;
    const proseOnly = check?.proseOnly ?? null;
    const suspect =
        check && check.concerns.length > 0
            ? {
                  concerns: check.concerns,
                  // A new attempt: the full reply stays one tap away
                  removeNotes: proseOnly === null ? undefined : () => record(proseOnly, attempts.currentPartial)
              }
            : null;

    return {
        // The saved selection is positional: the document stays frozen while a
        // selection sheet is up, so accept can't land on shifted or deleted nodes
        locksEditor: active?.kind === "selection" || active?.kind === "ask",
        sheetOpen: active !== null,
        toolbarActions,
        sheetProps: {
            title: active?.title ?? "",
            phase: generation.phase,
            // While streaming, the new text; otherwise the attempt being viewed
            text: generation.phase === "streaming" ? generation.text : (attempts.current ?? ""),
            attemptIndex: attempts.index,
            attemptCount: attempts.count,
            attemptPartial: attempts.currentPartial,
            suspect,
            onSelectAttempt: attempts.select,
            onAgain: active && !askPending ? onAgain : undefined,
            error: generation.error,
            status: generation.status,
            acceptLabel: active ? ACCEPT_LABELS[active.kind] : undefined,
            onAccept,
            onDiscard: close,
            onStop: generation.abort,
            onRefine: active && active.kind !== "summarise" ? onRefine : undefined,
            inputRequest:
                askPending && active?.kind === "ask"
                    ? {
                          placeholder: "What should happen to this passage? e.g. make the threat implicit…",
                          onSubmit: submitAsk
                      }
                    : null
        }
    };
};

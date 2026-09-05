import { useCallback, useRef, useState } from "react";
import {
    $createParagraphNode,
    $createTextNode,
    $getRoot,
    $getSelection,
    $isRangeSelection,
    $setSelection,
    HISTORY_PUSH_TAG,
    type RangeSelection
} from "lexical";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { attemptPromise } from "@jfdi/attempt";
import { toast } from "react-toastify";
import type { Chapter } from "@/types/story";
import { type ActionId, useActionGeneration } from "./useActionGeneration";

type ActionKind = "selection" | "continue" | "summarise";

interface ActiveAction {
    id: ActionId;
    title: string;
    kind: ActionKind;
}

const ACCEPT_LABELS: Record<ActionKind, string> = {
    selection: "Replace selection",
    continue: "Insert",
    summarise: "Save summary"
};

const RECENT_PROSE_CHAR_CAP = 100_000;

/**
 * Wires the built-in AI actions (contracts Phase 4) to the editor: selection
 * actions and Continue stream into a preview sheet and only touch the
 * document on Accept; Summarise saves the chapter summary with its source
 * revision for freshness tracking.
 */
export const useEditorActions = (chapter: Chapter) => {
    const [editor] = useLexicalComposerContext();
    const generation = useActionGeneration();
    const [active, setActive] = useState<ActiveAction | null>(null);
    const savedSelection = useRef<RangeSelection | null>(null);
    const summariseBaseRevision = useRef<number | null>(null);

    const docTextTail = useCallback(
        () => editor.getEditorState().read(() => $getRoot().getTextContent()).slice(-RECENT_PROSE_CHAR_CAP),
        [editor]
    );

    const baseContext = useCallback(
        // DB nulls must not reach the API's string validators
        () => ({
            ...(chapter.povCharacter ? { povCharacter: chapter.povCharacter } : {}),
            ...(chapter.povType ? { povType: chapter.povType as string } : {})
        }),
        [chapter.povCharacter, chapter.povType]
    );

    const onSelectionAction = useCallback(
        (actionId: "rework" | "expand" | "shorten", label: string) => {
            const info = editor.getEditorState().read(() => {
                const selection = $getSelection();
                if (!$isRangeSelection(selection) || selection.isCollapsed()) return null;
                return { text: selection.getTextContent(), clone: selection.clone() };
            });
            if (!info) {
                toast.info("Select some text first");
                return;
            }
            savedSelection.current = info.clone;
            // The saved selection is positional: freeze the document while the
            // sheet is up so accept can't land on shifted or deleted nodes
            editor.setEditable(false);
            setActive({ id: actionId, title: label, kind: "selection" });
            void generation.run({
                actionId,
                storyId: chapter.storyId,
                chapterId: chapter.id,
                editorContext: { ...baseContext(), selection: info.text, recentProse: docTextTail() }
            });
        },
        [editor, generation, chapter.storyId, chapter.id, baseContext, docTextTail]
    );

    const onContinue = useCallback(() => {
        setActive({ id: "continue", title: "Continue writing", kind: "continue" });
        void generation.run({
            actionId: "continue",
            storyId: chapter.storyId,
            chapterId: chapter.id,
            editorContext: { ...baseContext(), recentProse: docTextTail() }
        });
    }, [generation, chapter.storyId, chapter.id, baseContext, docTextTail]);

    const onSummarise = useCallback(() => {
        setActive({ id: "summarise_chapter", title: "Summarise chapter", kind: "summarise" });
        void (async () => {
            // Freshness is anchored to the revision the summary was GENERATED
            // from, not whatever revision exists when it is accepted
            const [, fresh] = await attemptPromise(async () => (await fetch(`/api/chapters/${chapter.id}`)).json());
            summariseBaseRevision.current = fresh?.revision ?? chapter.revision ?? 0;
            void generation.run({
                actionId: "summarise_chapter",
                storyId: chapter.storyId,
                chapterId: chapter.id
            });
        })();
    }, [generation, chapter.storyId, chapter.id, chapter.revision]);

    const close = useCallback(() => {
        setActive(null);
        savedSelection.current = null;
        editor.setEditable(true);
        generation.reset();
    }, [generation, editor]);

    const insertParagraphsAtEnd = (text: string) => {
        const paragraphs = text
            .split(/\n{2,}/)
            .map(p => p.trim())
            .filter(Boolean)
            .map(p => {
                const paragraph = $createParagraphNode();
                paragraph.append($createTextNode(p));
                return paragraph;
            });
        const root = $getRoot();
        paragraphs.forEach(p => root.append(p));
        paragraphs[paragraphs.length - 1]?.selectEnd();
    };

    const saveSummary = async (summary: string) => {
        const sourceRevision = summariseBaseRevision.current;
        if (sourceRevision === null) {
            toast.error("Couldn't save summary");
            return;
        }
        const [saveError, saveResponse] = await attemptPromise(() =>
            fetch(`/api/chapters/${chapter.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ summary, summarySourceRevision: sourceRevision })
            })
        );
        if (saveError || !saveResponse?.ok) toast.error("Couldn't save summary");
        else toast.success("Summary saved");
    };

    const onAccept = useCallback(() => {
        const kind = active?.kind;
        const text = generation.text;
        if (!kind || !text) return;

        if (kind === "selection")
            editor.update(
                () => {
                    const saved = savedSelection.current;
                    if (saved) $setSelection(saved.clone());
                    const selection = $getSelection();
                    if ($isRangeSelection(selection)) selection.insertText(text);
                },
                { tag: HISTORY_PUSH_TAG }
            );
        else if (kind === "continue") editor.update(() => insertParagraphsAtEnd(text), { tag: HISTORY_PUSH_TAG });
        else void saveSummary(text);

        close();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, generation.text, editor, close]);

    return {
        toolbarActions: { onContinue, onSummarise, onSelectionAction },
        sheetProps: {
            title: active?.title ?? "",
            phase: generation.phase,
            text: generation.text,
            error: generation.error,
            acceptLabel: active ? ACCEPT_LABELS[active.kind] : undefined,
            onAccept,
            onDiscard: close,
            onStop: generation.abort
        }
    };
};

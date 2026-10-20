import { useState } from "react";
import type { ActionId } from "@/types/actions";
import { type ActionEditorContext, useActionGeneration } from "../ai/useActionGeneration";
import { useSheetModel } from "../ai/useSheetModel";

/**
 * One layer of a transposition drafted as text (the brief, the synopsis):
 * every draft is kept on the server, so leaving and coming back loses
 * nothing. A draft the server couldn't take waits here with Save again —
 * generated text is never dropped because a save failed.
 */
export const useDraftLayer = ({
    storyId,
    action,
    saved,
    record,
    editorContext = {}
}: {
    storyId: string;
    action: { id: ActionId; label: string };
    /** Drafts the server holds. */
    saved: string[];
    /** Stores a draft; resolves false when it couldn't. */
    record: (text: string) => Promise<boolean>;
    editorContext?: ActionEditorContext;
}) => {
    const generation = useActionGeneration();
    const [unsaved, setUnsaved] = useState<string[]>([]);
    const [chosen, setChosen] = useState<number | null>(null);
    const [edits, setEdits] = useState<Record<number, string>>({});
    const drafts = [...saved, ...unsaved];
    // The newest draft unless the writer flipped back to an earlier one
    const index = chosen === null ? drafts.length - 1 : Math.min(chosen, drafts.length - 1);

    const keep = async (text: string) => {
        if (await record(text)) setUnsaved(current => current.filter(draft => draft !== text));
    };

    const run = async (guidance?: string) => {
        const result = await generation.run({
            actionId: action.id,
            storyId,
            editorContext: { ...editorContext, ...(guidance && { guidance }) }
        });
        if (result.outcome === "superseded" || !result.text.trim()) return;
        setUnsaved(current => [...current, result.text]);
        setChosen(null);
        await keep(result.text);
    };

    const model = useSheetModel({
        action,
        storyId,
        generation,
        attempts: { currentModel: null },
        onAgain: () => void run()
    });

    return {
        drafts,
        index,
        select: setChosen,
        /** The draft on show, with the writer's edits. */
        shown: index >= 0 ? (edits[index] ?? drafts[index]) : null,
        edit: (text: string) => setEdits(current => ({ ...current, [index]: text })),
        unsavedCount: unsaved.length,
        saveAgain: () => unsaved.forEach(text => void keep(text)),
        run,
        generation,
        model
    };
};

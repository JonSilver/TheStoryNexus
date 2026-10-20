import { useState } from "react";
import type { ActionId } from "@/types/actions";
import { type ActionEditorContext, useActionGeneration } from "../ai/useActionGeneration";
import { useSheetModel } from "../ai/useSheetModel";
import { useDraftEdits } from "./useDraftEdits";

/**
 * One layer of a transposition drafted as text (the brief, the synopsis):
 * every draft is kept on the server, so leaving and coming back loses
 * nothing. A draft the server couldn't take waits on screen with Save again
 * (and says it will be lost if the screen closes first).
 */
export const useDraftLayer = ({
    storyId,
    action,
    saved,
    record,
    saveEdit,
    editorContext = {}
}: {
    storyId: string;
    action: { id: ActionId; label: string };
    /** Drafts the server holds. */
    saved: string[];
    /** Stores a draft; resolves false when it couldn't. */
    record: (text: string) => Promise<boolean>;
    /** Stores the writer's edit to a saved draft. */
    saveEdit: (index: number, text: string) => Promise<boolean>;
    editorContext?: ActionEditorContext;
}) => {
    const generation = useActionGeneration();
    const [unsaved, setUnsaved] = useState<string[]>([]);
    const [chosen, setChosen] = useState<number | null>(null);
    const { edits, edit, settle } = useDraftEdits<string>((at, text) =>
        at < saved.length ? saveEdit(at, text) : Promise.resolve(false)
    );
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
        edit: (text: string) => edit(index, text),
        settleEdits: settle,
        unsavedCount: unsaved.length,
        saveAgain: () => unsaved.forEach(text => void keep(text)),
        run,
        generation,
        model
    };
};

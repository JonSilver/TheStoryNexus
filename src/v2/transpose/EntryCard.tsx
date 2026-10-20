import { attemptPromise } from "@jfdi/attempt";
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { AttemptNav } from "../ai/AttemptNav";
import { GenerationProgress } from "../ai/GenerationProgress";
import { SheetModelLine } from "../ai/SheetModelLine";
import { useSheetModel } from "../ai/useSheetModel";
import type { EntryState, EntryValue } from "./state";
import { useDraftEdits } from "./useDraftEdits";
import type { useEntryDrafting } from "./useEntryDrafting";

type Draft = Omit<EntryValue, "category">;

const aliases = (tags: string[]) => tags.join(", ");
const fromAliases = (text: string) =>
    text
        .split(",")
        .map(tag => tag.trim())
        .filter(Boolean);

/**
 * One bible entry: how it was, the drafts of how it could be (editable), and
 * the decision — accept a draft, or keep the entry as it was. A decided
 * entry can be reopened until the transposition moves on to chapters.
 */
export const EntryCard = ({
    entryId,
    entry,
    drafting
}: {
    entryId: string;
    entry: EntryState;
    drafting: ReturnType<typeof useEntryDrafting>;
}) => {
    const drafts: Draft[] = [...entry.attempts, ...(drafting.unsaved[entryId] ?? [])];
    const [chosen, setChosen] = useState<number | null>(null);
    const savedCount = entry.attempts.length;
    const { edits, edit: editDraft } = useDraftEdits<Draft>(async (at, value) => {
        if (at >= savedCount) return false;
        const [error] = await attemptPromise(() =>
            drafting.apply.mutateAsync({ op: "editEntryDraft", entryId, index: at, value })
        );
        return !error;
    });
    const [reopened, setReopened] = useState(false);
    const index = chosen === null ? drafts.length - 1 : Math.min(chosen, drafts.length - 1);
    const shown = index >= 0 ? (edits[index] ?? drafts[index]) : null;
    const edit = (patch: Partial<Draft>) => shown && editDraft(index, { ...shown, ...patch });
    const running = drafting.running === entryId;
    const busy = drafting.running !== null || drafting.progress !== null;
    const decided = entry.status !== "pending" && !reopened;
    const failed = drafting.errors[entryId];
    const [choosingModel, setChoosingModel] = useState(false);
    // Choosing another model saves it for this action, then tries this entry again with it
    const model = useSheetModel({
        action: { id: "transpose_entry", label: "Transpose: Bible Entry" },
        storyId: drafting.storyId,
        generation: drafting.generation,
        attempts: { currentModel: null },
        onAgain: () => void drafting.draft(entryId)
    });
    const { original } = entry;
    const decide = (op: "acceptEntry" | "keepEntry") =>
        drafting.apply.mutate(
            op === "acceptEntry" && shown ? { op, entryId, value: shown } : { op: "keepEntry", entryId },
            { onSuccess: () => setReopened(false) }
        );

    return (
        <li className="space-y-2 px-4 py-3" aria-label={original.name}>
            <div className="flex items-baseline gap-2">
                <p className="font-medium">{original.name}</p>
                <span className="text-xs text-muted-foreground">{original.category}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                    {entry.status === "accepted"
                        ? "Accepted"
                        : entry.status === "kept"
                          ? "Kept as it was"
                          : drafts.length
                            ? "Drafted"
                            : "Not transposed yet"}
                </span>
            </div>
            <p className="text-xs text-muted-foreground">{original.description}</p>

            {decided ? (
                <button type="button" className="text-xs underline" onClick={() => setReopened(true)}>
                    Change this decision
                </button>
            ) : (
                <>
                    {running && <GenerationProgress status={drafting.generation.status} />}
                    {shown && !running && (
                        <div className="space-y-2 rounded-md border p-2">
                            <input
                                aria-label="Transposed name"
                                className="w-full rounded-md border bg-background px-2 py-1 text-sm"
                                value={shown.name}
                                onChange={e => edit({ name: e.target.value })}
                            />
                            <input
                                aria-label="Also called"
                                placeholder="Also called (comma-separated)"
                                className="w-full rounded-md border bg-background px-2 py-1 text-xs"
                                value={aliases(shown.tags)}
                                onChange={e => edit({ tags: fromAliases(e.target.value) })}
                            />
                            <textarea
                                aria-label="Transposed description"
                                className="min-h-20 w-full resize-y rounded-md border bg-background p-2 text-sm"
                                value={shown.description}
                                onChange={e => edit({ description: e.target.value })}
                            />
                            {drafts.length > 1 && (
                                <AttemptNav label="Draft" index={index} count={drafts.length} onSelect={setChosen} />
                            )}
                        </div>
                    )}
                    {failed && (
                        <div className="space-y-2 text-xs">
                            <p className="text-destructive">{failed}</p>
                            {drafting.unreadable[entryId] && (
                                <div className="space-y-1">
                                    <p className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-2">
                                        {drafting.unreadable[entryId]}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => void drafting.takeReply(entryId)}
                                        className="rounded-md border bg-background px-2 py-1"
                                    >
                                        Use it as a draft
                                    </button>
                                </div>
                            )}
                            {busy ? (
                                <p className="text-muted-foreground">
                                    The other entries are still being transposed — Stop that to try this one again now.
                                </p>
                            ) : (
                                model && (
                                    <SheetModelLine
                                        model={model}
                                        choosing={choosingModel}
                                        onChoosing={setChoosingModel}
                                        canChange
                                    />
                                )
                            )}
                            {!busy && !choosingModel && (
                                <button
                                    type="button"
                                    onClick={() => setChoosingModel(true)}
                                    className="rounded-md border bg-background px-2 py-1"
                                >
                                    Use a different model for Transpose: Bible Entry
                                </button>
                            )}
                        </div>
                    )}
                    {(drafting.unsaved[entryId]?.length ?? 0) > 0 && (
                        <p role="alert" className="text-xs">
                            A draft hasn't been saved yet, and will be lost if you leave this screen.{" "}
                            <button type="button" className="underline" onClick={() => drafting.saveAgain(entryId)}>
                                Save again
                            </button>
                        </p>
                    )}
                    <div className="flex flex-wrap gap-2 text-sm">
                        {shown && (
                            <button
                                type="button"
                                disabled={busy || !shown.name.trim()}
                                onClick={() => decide("acceptEntry")}
                                className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground disabled:opacity-50"
                            >
                                Accept
                            </button>
                        )}
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => void drafting.draft(entryId)}
                            className="flex items-center gap-1 rounded-md border px-3 py-1.5 disabled:opacity-50"
                        >
                            {drafts.length > 0 && <RotateCcw className="h-3.5 w-3.5" />}
                            {drafts.length || failed ? "Try again" : "Transpose"}
                        </button>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => decide("keepEntry")}
                            className="rounded-md border px-3 py-1.5 disabled:opacity-50"
                        >
                            Keep as it was
                        </button>
                    </div>
                </>
            )}
        </li>
    );
};

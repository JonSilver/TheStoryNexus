import { attemptPromise } from "@jfdi/attempt";
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { AttemptNav } from "../ai/AttemptNav";
import { GenerationProgress } from "../ai/GenerationProgress";
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
                    {drafting.errors[entryId] && <p className="text-xs text-destructive">{drafting.errors[entryId]}</p>}
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
                            {drafts.length ? "Try again" : "Transpose"}
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

import { Square } from "lucide-react";
import { EntryCard } from "./EntryCard";
import { pendingEntries, type Transposition } from "./state";
import { useEntryDrafting } from "./useEntryDrafting";

/** Every entry decided — transposed or kept — before any prose moves, so the new setting's canon is fixed first. */
export const BibleStep = ({ transposition }: { transposition: Transposition }) => {
    const { state } = transposition;
    const drafting = useEntryDrafting(transposition);
    const pending = pendingEntries(state);
    const undrafted = pending.filter(id => !state.entries[id].attempts.length).length;
    const total = state.entryOrder.length;

    return (
        <section className="py-2">
            <div className="space-y-2 px-4 py-2 text-sm">
                <p className="text-muted-foreground">
                    Each entry is rewritten for the new setting against the brief. Accept a draft (edit it first if you
                    like), or keep the entry as it was. {total - pending.length} of {total} decided. Global entries are
                    shared by every story, so they aren't transposed.
                </p>
                {drafting.progress ? (
                    <div className="flex items-center gap-2">
                        <p role="status" className="flex-1">
                            Entry {drafting.progress.current} of {drafting.progress.total}: “{drafting.progress.name}”
                        </p>
                        <button
                            type="button"
                            onClick={drafting.stop}
                            className="flex items-center gap-1 rounded-md border px-3 py-1.5"
                        >
                            <Square className="h-3.5 w-3.5" /> Stop
                        </button>
                    </div>
                ) : (
                    undrafted > 0 && (
                        <button
                            type="button"
                            disabled={drafting.running !== null}
                            onClick={() => void drafting.sweep()}
                            className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground disabled:opacity-50"
                        >
                            {undrafted === total
                                ? "Transpose all entries"
                                : `Transpose the ${undrafted} remaining ${undrafted === 1 ? "entry" : "entries"}`}
                        </button>
                    )
                )}
                {drafting.sweepFailure && <p className="text-destructive">{drafting.sweepFailure}</p>}
            </div>
            {total === 0 && (
                <p className="px-4 py-2 text-sm">This story's bible is empty: nothing to transpose here.</p>
            )}
            <ul className="divide-y border-y">
                {state.entryOrder.map(id => (
                    <EntryCard key={id} entryId={id} entry={state.entries[id]} drafting={drafting} />
                ))}
            </ul>
            <div className="px-4 py-3">
                <button
                    type="button"
                    disabled={pending.length > 0 || drafting.apply.isPending}
                    onClick={() => drafting.apply.mutate({ op: "finishBible" })}
                    className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
                >
                    Go on to the chapters
                </button>
                {pending.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                        {pending.length} {pending.length === 1 ? "entry" : "entries"} still to decide.
                    </p>
                )}
            </div>
        </section>
    );
};

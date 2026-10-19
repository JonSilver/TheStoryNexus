import { ArrowLeftRight, Search, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { LorebookEntry } from "@/types/story";
import { entryMatches, findDuplicatePairs } from "./duplicates";

/**
 * Choosing WHICH two entries to merge is the whole job — so likely
 * duplicates are proposed up front (one tap picks the pair), the full list
 * is searchable and alphabetised by category, and both picks are shown with
 * their descriptions so the writer can confirm they really are the same
 * entity before any AI runs.
 */
export const MergePicker = ({
    entries,
    keep,
    duplicate,
    onPick,
    onPickPair,
    onSwap,
    onClear
}: {
    entries: LorebookEntry[];
    keep: LorebookEntry | null;
    duplicate: LorebookEntry | null;
    onPick: (entry: LorebookEntry) => void;
    onPickPair: (a: LorebookEntry, b: LorebookEntry) => void;
    onSwap: () => void;
    onClear: () => void;
}) => {
    const [search, setSearch] = useState("");
    const suggestions = useMemo(() => findDuplicatePairs(entries).slice(0, 5), [entries]);
    const listed = useMemo(
        () =>
            entries
                .filter(e => entryMatches(e, search))
                .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
        [entries, search]
    );

    const slot = (label: string, entry: LorebookEntry | null) => (
        <div className="min-w-0 flex-1 rounded-md border p-2">
            <p className="text-xs text-muted-foreground">{label}</p>
            {entry ? (
                <>
                    <p className="truncate font-medium">{entry.name}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{entry.description}</p>
                </>
            ) : (
                <p className="text-xs italic text-muted-foreground">tap an entry below</p>
            )}
        </div>
    );

    const selectedIds = new Set([keep?.id, duplicate?.id].filter(Boolean));

    return (
        <>
            <div className="flex items-stretch gap-2">
                {slot("Keep", keep)}
                <button
                    type="button"
                    onClick={onSwap}
                    disabled={!keep || !duplicate}
                    aria-label="Swap keep and duplicate"
                    className="self-center text-muted-foreground disabled:opacity-30"
                >
                    <ArrowLeftRight className="h-4 w-4" />
                </button>
                {slot("Fold in (deleted after)", duplicate)}
                {(keep || duplicate) && (
                    <button type="button" onClick={onClear} aria-label="Clear picks" className="self-center">
                        <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                )}
            </div>

            {suggestions.length > 0 && !keep && (
                <div>
                    <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <Sparkles className="h-3.5 w-3.5" /> Likely duplicates
                    </p>
                    <ul className="space-y-1">
                        {suggestions.map(pair => (
                            <li key={pair.a.id + pair.b.id}>
                                <button
                                    type="button"
                                    className="w-full rounded-md border border-primary/30 bg-primary/5 px-2 py-1.5 text-left"
                                    onClick={() => onPickPair(pair.a, pair.b)}
                                >
                                    <span className="font-medium">{pair.a.name}</span> +{" "}
                                    <span className="font-medium">{pair.b.name}</span>{" "}
                                    <span className="text-xs text-muted-foreground">— {pair.reason}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="flex items-center gap-2 rounded-md border px-2 py-1.5">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                    className="min-w-0 flex-1 bg-transparent outline-none"
                    placeholder="Search entries…"
                    aria-label="Search entries"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            <ul className="divide-y overflow-y-auto rounded-md border">
                {listed.map(entry => (
                    <li key={entry.id}>
                        <button
                            type="button"
                            onClick={() => onPick(entry)}
                            className={`w-full px-3 py-2 text-left ${selectedIds.has(entry.id) ? "bg-accent/60" : ""}`}
                        >
                            <span className="font-medium">{entry.name}</span>{" "}
                            <span className="text-xs text-muted-foreground">({entry.category})</span>
                            <span className="block truncate text-xs text-muted-foreground">{entry.description}</span>
                        </button>
                    </li>
                ))}
                {listed.length === 0 && (
                    <li className="px-3 py-4 text-center text-xs text-muted-foreground">Nothing matches.</li>
                )}
            </ul>
        </>
    );
};

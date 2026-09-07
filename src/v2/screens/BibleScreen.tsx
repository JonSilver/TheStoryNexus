import {
    ArrowLeft,
    GitMerge,
    BookOpenCheck,
    ClipboardPaste,
    FileScan,
    Plus,
    ScanSearch,
    ShieldQuestion,
    Trash2
} from "lucide-react";
import { useState } from "react";
import { useChaptersByStoryQuery } from "@/features/chapters/hooks/useChaptersQuery";
import { useDeleteLorebookMutation, useHierarchicalLorebookQuery } from "@/features/lorebook/hooks/useLorebookQuery";
import { useStoryQuery } from "@/features/stories/hooks/useStoriesQuery";
import type { LorebookEntry } from "@/types/story";
import type { ScreenProps } from "../V2App";
import { EntryEditor } from "../bible/EntryEditor";
import { type BibleFlowMode, ExtractSheet } from "../bible/ExtractSheet";
import { MergeSheet } from "../bible/MergeSheet";
import { takeNudgeHandoff } from "../bible/nameNudges";
import { useV2Store } from "../state/useV2Store";

const CATEGORY_ORDER = ["character", "location", "item", "event", "note", "synopsis", "starting scenario", "timeline"];

const FLOWS: Array<{ mode: BibleFlowMode; label: string; icon: typeof FileScan; needsChapter: boolean }> = [
    { mode: "extract-story", label: "Extract from whole story", icon: BookOpenCheck, needsChapter: true },
    { mode: "extract-chapter", label: "Extract from chapter", icon: FileScan, needsChapter: true },
    { mode: "extract-paste", label: "Extract from pasted text", icon: ClipboardPaste, needsChapter: false },
    { mode: "updates", label: "Scan for updates", icon: ScanSearch, needsChapter: true },
    { mode: "continuity", label: "Check continuity", icon: ShieldQuestion, needsChapter: true }
];

const groupEntries = (entries: LorebookEntry[]) =>
    CATEGORY_ORDER.map(category => ({
        category,
        items: entries.filter(e => e.category === category)
    })).filter(group => group.items.length > 0);

export const BibleScreen = ({ goTo }: ScreenProps) => {
    const { currentStoryId, lastChapterFor } = useV2Store();
    const { data: entries } = useHierarchicalLorebookQuery(currentStoryId ?? undefined);
    const { data: chapters } = useChaptersByStoryQuery(currentStoryId ?? "");
    const deleteEntry = useDeleteLorebookMutation();
    const { data: story } = useStoryQuery(currentStoryId ?? "");
    const [editing, setEditing] = useState<LorebookEntry | null | "new">(null);
    const [merging, setMerging] = useState(false);
    // Arriving via the editor's nudge chip auto-opens a focused extraction —
    // the chip says "Add to bible", so landing here must actually start adding
    const [focusNames] = useState(takeNudgeHandoff);
    const [flow, setFlow] = useState<BibleFlowMode | null>(focusNames.length > 0 ? "extract-chapter" : null);

    if (!currentStoryId)
        return (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                <p className="text-muted-foreground">Pick a story first.</p>
                <button
                    type="button"
                    className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
                    onClick={() => goTo("library")}
                >
                    Choose a story
                </button>
            </div>
        );

    const chapterId =
        lastChapterFor(currentStoryId) ?? [...(chapters ?? [])].sort((a, b) => a.order - b.order)[0]?.id ?? null;
    const groups = groupEntries(entries ?? []);

    return (
        <div className="flex h-full flex-col">
            <header className="flex items-center gap-2 border-b px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                <button type="button" onClick={() => goTo("story")} aria-label="Back">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <h1 className="text-lg font-semibold">Story Bible</h1>
                <button type="button" onClick={() => setEditing("new")} aria-label="New entry" className="ml-auto">
                    <Plus className="h-5 w-5" />
                </button>
            </header>

            <div className="flex gap-2 overflow-x-auto border-b p-3">
                <button
                    key="merge"
                    type="button"
                    disabled={(entries?.length ?? 0) < 2}
                    onClick={() => setMerging(true)}
                    className="flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                >
                    <GitMerge className="h-4 w-4" /> Merge duplicates
                </button>
                {FLOWS.map(({ mode, label, icon: Icon, needsChapter }) => (
                    <button
                        key={mode}
                        type="button"
                        disabled={needsChapter && !chapterId}
                        onClick={() => setFlow(mode)}
                        className="flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                    >
                        <Icon className="h-4 w-4" /> {label}
                    </button>
                ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
                {groups.length === 0 && (
                    <p className="p-8 text-center text-sm text-muted-foreground">
                        No entries yet — try “Extract from whole story” above to build your bible in one pass.
                    </p>
                )}
                {groups.map(group => (
                    <section key={group.category}>
                        <h2 className="bg-muted/50 px-4 py-1 text-xs font-semibold uppercase text-muted-foreground">
                            {group.category}
                        </h2>
                        <ul className="divide-y">
                            {group.items.map(entry => (
                                <li key={entry.id} className="flex items-start gap-2 px-4 py-2">
                                    <button
                                        type="button"
                                        className="min-w-0 flex-1 text-left"
                                        onClick={() => setEditing(entry)}
                                        aria-label={`Edit ${entry.name}`}
                                    >
                                        <p className="font-medium">
                                            {entry.name}
                                            {entry.level !== "story" && (
                                                <span className="ml-2 text-xs text-muted-foreground">
                                                    ({entry.level})
                                                </span>
                                            )}
                                        </p>
                                        <p className="text-sm text-muted-foreground">{entry.description}</p>
                                        {Array.isArray(entry.tags) && entry.tags.length > 0 && (
                                            <p className="text-xs text-muted-foreground">
                                                aka: {entry.tags.join(", ")}
                                            </p>
                                        )}
                                    </button>
                                    {entry.level === "story" && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                window.confirm(`Delete the bible entry “${entry.name}”?`) &&
                                                deleteEntry.mutate(entry.id)
                                            }
                                            aria-label={`Delete ${entry.name}`}
                                            className="mt-1 text-muted-foreground"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}
            </div>

            {merging && <MergeSheet entries={entries ?? []} onClose={() => setMerging(false)} />}
            {editing && (
                <EntryEditor
                    entry={editing === "new" ? null : editing}
                    storyId={currentStoryId}
                    seriesId={story?.seriesId ?? null}
                    onClose={() => setEditing(null)}
                />
            )}
            {flow && (
                <ExtractSheet
                    mode={flow}
                    storyId={currentStoryId}
                    chapterId={chapterId}
                    chapters={[...(chapters ?? [])].sort((a, b) => a.order - b.order)}
                    entries={entries ?? []}
                    focusNames={flow === "extract-chapter" ? focusNames : []}
                    onClose={() => setFlow(null)}
                />
            )}
        </div>
    );
};

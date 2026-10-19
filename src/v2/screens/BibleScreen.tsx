import {
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
import { LOREBOOK_CATEGORIES, type LorebookEntry } from "@/types/story";
import { EntryEditor } from "../bible/EntryEditor";
import { type BibleFlowMode, ExtractSheet } from "../bible/ExtractSheet";
import { MergeSheet } from "../bible/MergeSheet";
import { entryMatches } from "../bible/duplicates";
import { takeNudgeHandoff } from "../bible/nameNudges";
import { useConfirm } from "../components/Dialogs";
import { ScreenHeader, NoStoryChosen } from "../components/ScreenParts";
import { useNav } from "../routing";
import { useCurrentStoryId, useUiState } from "../state/useV2Store";

const FLOWS: Array<{ mode: BibleFlowMode; label: string; icon: typeof FileScan; needsChapter: boolean }> = [
    { mode: "extract-story", label: "Extract from whole story", icon: BookOpenCheck, needsChapter: true },
    { mode: "extract-chapter", label: "Extract from chapter", icon: FileScan, needsChapter: true },
    { mode: "extract-paste", label: "Extract from pasted text", icon: ClipboardPaste, needsChapter: false },
    { mode: "updates", label: "Scan for updates", icon: ScanSearch, needsChapter: true },
    { mode: "continuity", label: "Check continuity", icon: ShieldQuestion, needsChapter: true }
];

const groupEntries = (entries: LorebookEntry[]) =>
    LOREBOOK_CATEGORIES.map(category => ({
        category,
        items: entries.filter(e => e.category === category).sort((a, b) => a.name.localeCompare(b.name))
    })).filter(group => group.items.length > 0);

export const BibleScreen = () => {
    const { goTo, goBack } = useNav();
    const currentStoryId = useCurrentStoryId();
    const rememberedChapter = useUiState(state =>
        currentStoryId ? (state.lastChapterByStory[currentStoryId] ?? null) : null
    );
    const { data: entries } = useHierarchicalLorebookQuery(currentStoryId ?? undefined);
    const { data: chapters } = useChaptersByStoryQuery(currentStoryId ?? "");
    const deleteEntry = useDeleteLorebookMutation();
    const confirm = useConfirm();
    const { data: story } = useStoryQuery(currentStoryId ?? "");
    // The id, not a copy: the editor sees the entry as it is now, and closes if it's gone
    const [editingId, setEditingId] = useState<string | null | "new">(null);
    const editing = (entries ?? []).find(e => e.id === editingId) ?? null;
    const [merging, setMerging] = useState(false);
    const [search, setSearch] = useState("");
    // Arriving via the editor's nudge chip auto-opens a focused extraction —
    // the chip says "Add to bible", so landing here must actually start adding
    const [focusNames] = useState(takeNudgeHandoff);
    const [flow, setFlow] = useState<BibleFlowMode | null>(focusNames.length > 0 ? "extract-chapter" : null);

    if (!currentStoryId) return <NoStoryChosen onChoose={() => goTo("library")} />;

    const chapterId = rememberedChapter ?? (chapters ?? [])[0]?.id ?? null;
    const groups = groupEntries((entries ?? []).filter(e => entryMatches(e, search)));

    return (
        <div className="flex h-full flex-col">
            <ScreenHeader title="Story Bible" onBack={() => goBack("story")}>
                <button type="button" onClick={() => setEditingId("new")} aria-label="New entry">
                    <Plus className="h-5 w-5" />
                </button>
            </ScreenHeader>

            <div className="flex gap-2 overflow-x-auto border-b p-3">
                <button
                    key="merge"
                    type="button"
                    disabled={
                        (entries ?? []).filter(e => e.level === "story" && e.scopeId === currentStoryId).length < 2
                    }
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

            <div className="border-b px-4 py-2">
                <input
                    className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                    placeholder="Search the bible…"
                    aria-label="Search bible entries"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
                {groups.length === 0 && search.trim() !== "" && (
                    <p className="p-8 text-center text-sm text-muted-foreground">Nothing matches “{search}”.</p>
                )}
                {groups.length === 0 && search.trim() === "" && (
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
                                        onClick={() => setEditingId(entry.id)}
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
                                            onClick={async () => {
                                                if (
                                                    await confirm({
                                                        message: `Delete the bible entry “${entry.name}”?`,
                                                        confirmLabel: "Delete"
                                                    })
                                                )
                                                    deleteEntry.mutate(entry.id);
                                            }}
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

            {merging && (
                <MergeSheet entries={entries ?? []} storyId={currentStoryId} onClose={() => setMerging(false)} />
            )}
            {(editingId === "new" || editing) && (
                <EntryEditor
                    entry={editing}
                    storyId={currentStoryId}
                    seriesId={story?.seriesId ?? null}
                    onClose={() => setEditingId(null)}
                />
            )}
            {flow && (
                <ExtractSheet
                    mode={flow}
                    storyId={currentStoryId}
                    chapterId={chapterId}
                    chapters={chapters ?? []}
                    entries={entries ?? []}
                    focusNames={flow === "extract-chapter" ? focusNames : []}
                    onClose={() => setFlow(null)}
                />
            )}
        </div>
    );
};

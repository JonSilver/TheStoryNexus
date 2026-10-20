import { useIsMutating } from "@tanstack/react-query";
import {
    BookOpen,
    BookOpenText,
    ChevronRight,
    Copy,
    Download,
    Library,
    ListOrdered,
    NotebookPen,
    SlidersHorizontal,
    Trash2
} from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";
import { useChaptersByStoryQuery } from "@/features/chapters/hooks/useChaptersQuery";
import { useHierarchicalLorebookQuery } from "@/features/lorebook/hooks/useLorebookQuery";
import { useSingleSeriesQuery } from "@/features/series/hooks/useSeriesQuery";
import {
    useDeleteStoryMutation,
    useDuplicateStoryMutation,
    useStoryQuery
} from "@/features/stories/hooks/useStoriesQuery";
import { useConfirm, usePrompt } from "../components/Dialogs";
import { EmptyState } from "../components/ScreenParts";
import { flushChapterSave } from "../editor/useChapterSaver";
import { useNav } from "../routing";
import { uiState, useCurrentStoryId } from "../state/useV2Store";
import { ExportButtons } from "./ExportButtons";
import { StoryDetailsEditor } from "./StoryDetailsEditor";
import { StoryVoiceEditor } from "./StoryVoiceEditor";

/**
 * The current story's home: named after the story (the answer to "which
 * story am I in?"), with its working surfaces up top and its setup folded
 * away — not a dumping ground.
 */
export const StoryHubScreen = () => {
    const { goTo } = useNav();
    const currentStoryId = useCurrentStoryId();
    const { setCurrentStory, lastChapterFor } = uiState;
    const { data: story } = useStoryQuery(currentStoryId ?? "");
    const { data: chapters } = useChaptersByStoryQuery(currentStoryId ?? "");
    const { data: series } = useSingleSeriesQuery(story?.seriesId ?? undefined);
    const { data: entries } = useHierarchicalLorebookQuery(currentStoryId ?? undefined);
    const deleteStory = useDeleteStoryMutation();
    const duplicateStory = useDuplicateStoryMutation();
    const confirm = useConfirm();
    const prompt = usePrompt();
    const saving = useIsMutating();
    const [flushing, setFlushing] = useState(false);
    const duplicating = flushing || duplicateStory.isPending;

    const wordCount = (chapters ?? []).reduce((sum, c) => sum + (c.wordCount ?? 0), 0);

    const removeStory = async () => {
        if (!story) return;
        const summary = `${chapters?.length ?? 0} chapter${(chapters?.length ?? 0) === 1 ? "" : "s"}, ${wordCount.toLocaleString()} words`;
        const message = `Delete “${story.title}” (${summary})? Chapters, bible entries, notes and chats go with it. This cannot be undone.`;
        if (!(await confirm({ message, confirmLabel: "Delete story" }))) return;
        deleteStory.mutate(story.id, {
            onSuccess: () => {
                setCurrentStory(null);
                goTo("library");
            }
        });
    };

    const duplicate = async () => {
        if (!story) return;
        const title = await prompt({
            title: "Duplicate story",
            label: "Title of the copy",
            initial: `${story.title} (copy)`,
            confirmLabel: "Duplicate"
        });
        if (!title) return;
        // The copy must hold the last keystrokes, not race the debounce
        const openChapter = lastChapterFor(story.id);
        setFlushing(true);
        if (openChapter) await flushChapterSave(openChapter);
        setFlushing(false);
        duplicateStory.mutate(
            { id: story.id, title },
            {
                onSuccess: ({ storyId, assetsFailed }) => {
                    if (assetsFailed.length > 0)
                        toast.error(`${assetsFailed.length} image(s) couldn't be copied: ${assetsFailed.join(", ")}`);
                    goTo("story", { storyId });
                }
            }
        );
    };

    if (!currentStoryId)
        return (
            <EmptyState
                message="Pick a story to see its workspace."
                actionLabel="Open the library"
                onAction={() => goTo("library")}
            />
        );

    const rowClass = "flex w-full items-center gap-3 px-4 py-3 text-left";
    const rows = [
        {
            label: "Chapters",
            detail: `${chapters?.length ?? 0}`,
            icon: ListOrdered,
            onClick: () => goTo("chapters")
        },
        { label: "Story Bible", detail: `${entries?.length ?? 0}`, icon: BookOpenText, onClick: () => goTo("bible") },
        { label: "Notes", detail: "", icon: NotebookPen, onClick: () => goTo("notes") },
        { label: "Read", detail: "", icon: BookOpen, onClick: () => goTo("read") },
        { label: "Switch story", detail: "", icon: Library, onClick: () => goTo("library") }
    ];

    return (
        <div className="flex h-full flex-col overflow-y-auto">
            <header className="border-b px-4 py-4 pt-[max(1rem,env(safe-area-inset-top))]">
                <h1 className="text-xl font-semibold leading-tight">{story?.title ?? "…"}</h1>
                <p className="mt-0.5 text-xs text-muted-foreground">
                    {[series?.name, `${wordCount.toLocaleString()} words`, story?.language].filter(Boolean).join(" · ")}
                </p>
            </header>

            <ul className="divide-y border-b">
                {rows.map(({ label, detail, icon: Icon, onClick }) => (
                    <li key={label}>
                        <button type="button" className={rowClass} onClick={onClick}>
                            <Icon className="h-5 w-5 text-muted-foreground" />
                            <span className="flex-1">{label}</span>
                            {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </button>
                    </li>
                ))}
            </ul>

            <details className="border-b">
                <summary className="cursor-pointer list-none px-4 py-3 font-medium [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center gap-3">
                        <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
                        <span className="flex-1">Details, series &amp; voice</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </span>
                </summary>
                {/* Keyed: another story's drafts start afresh */}
                <StoryDetailsEditor key={`details-${currentStoryId}`} storyId={currentStoryId} />
                <StoryVoiceEditor key={`voice-${currentStoryId}`} storyId={currentStoryId} />
            </details>

            <details className="border-b">
                <summary className="cursor-pointer list-none px-4 py-3 font-medium [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center gap-3">
                        <Download className="h-5 w-5 text-muted-foreground" />
                        <span className="flex-1">Export</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </span>
                </summary>
                <ExportButtons storyId={currentStoryId} />
            </details>

            <button
                type="button"
                onClick={duplicate}
                // A save still on its way (details, series, voice) would be missing from the copy
                disabled={!story || duplicating || saving > 0}
                className="mt-auto flex w-full items-center gap-3 px-4 py-3 text-left text-sm disabled:opacity-50"
            >
                <Copy className="h-4 w-4" /> {duplicating ? "Duplicating…" : "Duplicate this story…"}
            </button>
            <button
                type="button"
                onClick={removeStory}
                disabled={deleteStory.isPending}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-destructive disabled:opacity-50"
            >
                <Trash2 className="h-4 w-4" /> Delete this story…
            </button>
        </div>
    );
};

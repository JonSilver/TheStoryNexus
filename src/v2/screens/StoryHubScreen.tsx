import {
    BookOpen,
    BookOpenText,
    ChevronRight,
    Download,
    Library,
    ListOrdered,
    NotebookPen,
    SlidersHorizontal
} from "lucide-react";
import { Link } from "react-router";
import { useChaptersByStoryQuery } from "@/features/chapters/hooks/useChaptersQuery";
import { useHierarchicalLorebookQuery } from "@/features/lorebook/hooks/useLorebookQuery";
import { useSingleSeriesQuery } from "@/features/series/hooks/useSeriesQuery";
import { useStoryQuery } from "@/features/stories/hooks/useStoriesQuery";
import type { ScreenProps } from "../V2App";
import { useV2Store } from "../state/useV2Store";
import { ExportButtons } from "./ExportButtons";
import { StoryDetailsEditor } from "./StoryDetailsEditor";
import { StoryVoiceEditor } from "./StoryVoiceEditor";

/**
 * The current story's home: named after the story (the answer to "which
 * story am I in?"), with its working surfaces up top and its setup folded
 * away — not a dumping ground.
 */
export const StoryHubScreen = ({ goTo }: ScreenProps) => {
    const { currentStoryId } = useV2Store();
    const { data: story } = useStoryQuery(currentStoryId ?? "");
    const { data: chapters } = useChaptersByStoryQuery(currentStoryId ?? "");
    const { data: series } = useSingleSeriesQuery(story?.seriesId ?? undefined);
    const { data: entries } = useHierarchicalLorebookQuery(currentStoryId ?? undefined);

    if (!currentStoryId)
        return (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                <p className="text-muted-foreground">Pick a story to see its workspace.</p>
                <button
                    type="button"
                    className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
                    onClick={() => goTo("library")}
                >
                    Open the library
                </button>
            </div>
        );

    const wordCount = (chapters ?? []).reduce((sum, c) => sum + (c.wordCount ?? 0), 0);
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
                <li>
                    <Link to={`/stories/${currentStoryId}/read`} className={rowClass}>
                        <BookOpen className="h-5 w-5 text-muted-foreground" />
                        <span className="flex-1">Read</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                </li>
            </ul>

            <details className="border-b">
                <summary className="cursor-pointer list-none px-4 py-3 font-medium [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center gap-3">
                        <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
                        <span className="flex-1">Details, series &amp; voice</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </span>
                </summary>
                <StoryDetailsEditor storyId={currentStoryId} />
                <StoryVoiceEditor storyId={currentStoryId} />
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
        </div>
    );
};

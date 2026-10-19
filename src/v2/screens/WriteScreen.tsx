import { Loader2 } from "lucide-react";
import { Navigate } from "react-router";
import { useChapterQuery, useChaptersByStoryQuery } from "@/features/chapters/hooks/useChaptersQuery";
import { useStoryQuery } from "@/features/stories/hooks/useStoriesQuery";
import { EmptyState } from "../components/ScreenParts";
import { ChapterEditor } from "../editor/ChapterEditor";
import { useRouteParams } from "../routeParams";
import { pathFor, useNav } from "../routing";
import { useCurrentStoryId, useUiState } from "../state/useV2Store";

const Spinner = () => (
    <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
);

export const WriteScreen = () => {
    const { goTo } = useNav();
    const currentStoryId = useCurrentStoryId();
    const rememberedChapter = useUiState(state =>
        currentStoryId ? (state.lastChapterByStory[currentStoryId] ?? null) : null
    );
    // A missing story (404) never reaches here: the story route says so first
    const { data: story, isError: storyFailed } = useStoryQuery(currentStoryId ?? "");
    const {
        data: chapters,
        isLoading: chaptersLoading,
        isError: chaptersFailed,
        refetch: refetchChapters
    } = useChaptersByStoryQuery(currentStoryId ?? "");

    // The URL's chapter wins; otherwise resume the last one, else the first
    const route = useRouteParams();
    const resumeId = route.chapterId ?? rememberedChapter;
    const orderedChapters = chapters ?? [];
    const currentChapterId =
        resumeId && orderedChapters.some(c => c.id === resumeId) ? resumeId : (orderedChapters[0]?.id ?? null);

    const { data: chapter, isLoading: chapterLoading } = useChapterQuery(currentChapterId ?? "");

    if (!currentStoryId)
        return (
            <EmptyState
                message="Pick a story to start writing."
                actionLabel="Choose a story"
                onAction={() => goTo("library")}
            />
        );
    if (chaptersFailed || storyFailed)
        return (
            <EmptyState
                message="Couldn't reach the server — your work is safe on disk."
                actionLabel="Try again"
                onAction={() => void refetchChapters()}
            />
        );
    if (chaptersLoading || (currentChapterId && chapterLoading)) return <Spinner />;
    if (!currentChapterId)
        return (
            <EmptyState
                message="This story has no chapters yet."
                actionLabel="Create a chapter"
                onAction={() => goTo("chapters")}
            />
        );
    // The URL names the chapter actually shown: filled in, or a stale/unknown id corrected, without a history entry
    if (route.storyId && route.chapterId !== currentChapterId)
        return <Navigate replace to={pathFor("write", route.storyId, currentChapterId)} />;
    if (!chapter) return <Spinner />;

    return (
        <div className="flex h-full min-h-0 flex-col">
            <header className="flex items-center gap-2 border-b px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
                <div className="min-w-0">
                    <p className="truncate text-xs text-muted-foreground">{story?.title}</p>
                    <select
                        className="max-w-[70vw] truncate bg-transparent text-sm font-medium outline-none"
                        value={chapter.id}
                        onChange={e => goTo("write", { chapterId: e.target.value })}
                        aria-label="Chapter"
                    >
                        {orderedChapters.map(c => (
                            <option key={c.id} value={c.id}>
                                {c.title}
                            </option>
                        ))}
                    </select>
                </div>
            </header>
            <div className="min-h-0 flex-1">
                {/* Keyed by id only: background refetches must not remount a live editor */}
                <ChapterEditor key={chapter.id} chapter={chapter} onOpenBible={() => goTo("bible")} />
            </div>
        </div>
    );
};

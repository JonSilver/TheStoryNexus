import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useChapterQuery, useChaptersByStoryQuery } from "@/features/chapters/hooks/useChaptersQuery";
import { useStoryQuery } from "@/features/stories/hooks/useStoriesQuery";
import type { ScreenProps } from "../V2App";
import { ChapterEditor } from "../editor/ChapterEditor";
import { useV2Store } from "../state/useV2Store";

const Empty = ({ message, actionLabel, onAction }: { message: string; actionLabel: string; onAction: () => void }) => (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-muted-foreground">{message}</p>
        <button type="button" className="rounded-md bg-primary px-4 py-2 text-primary-foreground" onClick={onAction}>
            {actionLabel}
        </button>
    </div>
);

const Spinner = () => (
    <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
);

export const WriteScreen = ({ goTo }: ScreenProps) => {
    const { currentStoryId, lastChapterFor, setLastChapter, setCurrentStory } = useV2Store();
    const { data: story, error: storyError } = useStoryQuery(currentStoryId ?? "");
    const {
        data: chapters,
        isLoading: chaptersLoading,
        isError: chaptersFailed,
        refetch: refetchChapters
    } = useChaptersByStoryQuery(currentStoryId ?? "");

    // Only a definite 404 means the story is gone. A network blip or server
    // restart must NOT clear the remembered story and eject the writer.
    const storyGone = (storyError as { status?: number } | null)?.status === 404;
    useEffect(() => {
        if (currentStoryId && storyGone) {
            setCurrentStory(null);
            goTo("stories");
        }
    }, [currentStoryId, storyGone, setCurrentStory, goTo]);

    const resumeId = currentStoryId ? lastChapterFor(currentStoryId) : null;
    const orderedChapters = [...(chapters ?? [])].sort((a, b) => a.order - b.order);
    const currentChapterId =
        resumeId && orderedChapters.some(c => c.id === resumeId) ? resumeId : (orderedChapters[0]?.id ?? null);

    const { data: chapter, isLoading: chapterLoading } = useChapterQuery(currentChapterId ?? "");

    if (!currentStoryId)
        return (
            <Empty
                message="Pick a story to start writing."
                actionLabel="Choose a story"
                onAction={() => goTo("stories")}
            />
        );
    if (chaptersFailed || (storyError && !storyGone))
        return (
            <Empty
                message="Couldn't reach the server — your work is safe on disk."
                actionLabel="Try again"
                onAction={() => void refetchChapters()}
            />
        );
    if (chaptersLoading || (currentChapterId && chapterLoading)) return <Spinner />;
    if (!currentChapterId)
        return (
            <Empty
                message="This story has no chapters yet."
                actionLabel="Create a chapter"
                onAction={() => goTo("chapters")}
            />
        );
    if (!chapter) return <Spinner />;

    return (
        <div className="flex h-full min-h-0 flex-col">
            <header className="flex items-center gap-2 border-b px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
                <div className="min-w-0">
                    <p className="truncate text-xs text-muted-foreground">{story?.title}</p>
                    <select
                        className="max-w-[70vw] truncate bg-transparent text-sm font-medium outline-none"
                        value={chapter.id}
                        onChange={e => setLastChapter(currentStoryId, e.target.value)}
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

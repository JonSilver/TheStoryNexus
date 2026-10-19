import { Loader2 } from "lucide-react";
import { useChaptersByStoryQuery } from "@/features/chapters/hooks/useChaptersQuery";
import { ChapterReader } from "@/features/stories/components/ChapterReader";
import { useStoryQuery } from "@/features/stories/hooks/useStoriesQuery";
import type { ScreenProps } from "../V2App";
import { ScreenHeader } from "../components/ScreenParts";
import { useCurrentStoryId } from "../state/useV2Store";

/** Reading mode inside the shell: the whole story as one continuous scroll. */
export const ReadScreen = ({ goBack }: ScreenProps) => {
    const currentStoryId = useCurrentStoryId();
    const { data: story } = useStoryQuery(currentStoryId ?? "");
    const { data: chapters, isLoading } = useChaptersByStoryQuery(currentStoryId ?? "");

    // Only routed inside /story/:storyId, so a story is always present
    if (!currentStoryId) return null;
    const ordered = chapters ?? [];

    return (
        <div className="flex h-full flex-col">
            <ScreenHeader title={story?.title} onBack={() => goBack("story")} />
            <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto max-w-2xl space-y-12 px-4 py-8">
                    {isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />}
                    {ordered.map((chapter, index) => (
                        <ChapterReader key={chapter.id} chapter={chapter} chapterNumber={index + 1} />
                    ))}
                    {!isLoading && ordered.length === 0 && (
                        <p className="text-center text-sm text-muted-foreground">Nothing to read yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

import { Plus } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { StoryEditor } from "@/features/chapters/components/StoryEditor";
import { useChapterQuery, useChaptersByStoryQuery } from "@/features/chapters/hooks/useChaptersQuery";
import { LorebookProvider } from "@/features/lorebook/context/LorebookContext";
import { ChapterMatchingProvider } from "@/features/lorebook/hooks/useChapterMatching";
import { useStoryContext } from "@/features/stories/context/StoryContext";
import { useStoryQuery } from "@/features/stories/hooks/useStoriesQuery";

export const EditorTool = () => {
    const { currentStoryId, currentChapterId, setCurrentChapterId, setCurrentTool } = useStoryContext();
    const { data: story, isLoading: storyLoading } = useStoryQuery(currentStoryId || "");
    const { data: chapters = [], isLoading: chaptersLoading } = useChaptersByStoryQuery(currentStoryId || "");
    const { data: chapter, isLoading: chapterLoading } = useChapterQuery(currentChapterId || "");

    // Initialize currentChapterId to first chapter if not set
    useEffect(() => {
        if (currentStoryId && !currentChapterId && chapters.length > 0) {
            setCurrentChapterId(chapters[0].id);
        }
    }, [currentStoryId, currentChapterId, chapters, setCurrentChapterId]);

    // Loading state
    if (storyLoading || chaptersLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-muted-foreground">Loading...</div>
            </div>
        );
    }

    // No story selected
    if (!currentStoryId || !story) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-4">
                    <p className="text-lg font-semibold">No Story Selected</p>
                    <p className="text-muted-foreground">Select a story from the Stories tool to start writing</p>
                </div>
            </div>
        );
    }

    // No chapters exist
    if (chapters.length === 0) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-4">
                    <p className="text-lg font-semibold">No Chapters Yet</p>
                    <p className="text-muted-foreground">Create your first chapter to start writing</p>
                    <Button onClick={() => setCurrentTool("chapters")}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create First Chapter
                    </Button>
                </div>
            </div>
        );
    }

    // Loading current chapter
    if (currentChapterId && chapterLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-muted-foreground">Loading chapter...</div>
            </div>
        );
    }

    // Chapter not found
    if (currentChapterId && !chapter) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-4">
                    <p className="text-lg font-semibold">Chapter Not Found</p>
                    <p className="text-muted-foreground">The selected chapter could not be found</p>
                </div>
            </div>
        );
    }

    // Render editor
    return (
        <LorebookProvider storyId={currentStoryId}>
            <ChapterMatchingProvider>
                <div className="h-full">
                    <StoryEditor />
                </div>
            </ChapterMatchingProvider>
        </LorebookProvider>
    );
};

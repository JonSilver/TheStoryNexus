import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useChaptersByStoryQuery } from "@/features/chapters/hooks/useChaptersQuery";
import { useStoryContext } from "@/features/stories/context/StoryContext";
import type { Chapter } from "@/types/story";

export const ChapterSwitcher = () => {
    const { currentStoryId, currentChapterId, currentTool, setCurrentChapterId } = useStoryContext();
    const { data: chapters = [] } = useChaptersByStoryQuery(currentStoryId || "");

    const currentChapter = chapters.find((c: Chapter) => c.id === currentChapterId);
    const currentChapterIndex = chapters.findIndex((c: Chapter) => c.id === currentChapterId);
    const currentChapterNumber = currentChapterIndex !== -1 ? currentChapterIndex + 1 : null;

    // Only show for editor tool
    if (currentTool !== "editor") 
        return null;
    

    if (!currentStoryId || !currentChapterId || chapters.length === 0) 
        return null;
    

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2" size="sm">
                    {currentChapterNumber ? `${currentChapterNumber}: ${currentChapter?.title}` : "Chapter"}
                    <span className="text-muted-foreground">▾</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 max-h-96 overflow-y-auto">
                {chapters.map((chapter: Chapter, index: number) => (
                    <DropdownMenuItem
                        key={chapter.id}
                        onClick={() => setCurrentChapterId(chapter.id)}
                        className={chapter.id === currentChapterId ? "bg-accent" : ""}
                    >
                        <div className="flex flex-col">
                            <span>
                                {index + 1}: {chapter.title}
                            </span>
                            {chapter.wordCount && (
                                <span className="text-xs text-muted-foreground">{chapter.wordCount} words</span>
                            )}
                        </div>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

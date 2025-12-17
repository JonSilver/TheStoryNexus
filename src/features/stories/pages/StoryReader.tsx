import { ArrowLeft, Loader2 } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/urls";
import { useChaptersByStoryQuery } from "@/features/chapters/hooks/useChaptersQuery";
import { useStoryQuery } from "@/features/stories/hooks/useStoriesQuery";
import { ChapterReader } from "../components/ChapterReader";

export function StoryReader() {
    const { storyId } = useParams<{ storyId: string }>();
    const navigate = useNavigate();

    const { data: story, isLoading: storyLoading } = useStoryQuery(storyId ?? "");
    const { data: chapters = [], isLoading: chaptersLoading } = useChaptersByStoryQuery(storyId ?? "");

    const isLoading = storyLoading || chaptersLoading;

    if (isLoading) 
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    

    if (!story) 
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-4">
                <p className="text-muted-foreground">Story not found</p>
                <Button onClick={() => navigate(ROUTES.STORIES)}>Return to Stories</Button>
            </div>
        );
    

    const sortedChapters = [...chapters].sort((a, b) => a.order - b.order);

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
                <div className="container max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(ROUTES.STORIES)}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold">{story.title}</h1>
                        <p className="text-sm text-muted-foreground">by {story.author}</p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="container max-w-4xl mx-auto px-4 py-8">
                {/* Synopsis */}
                {story.synopsis && (
                    <div className="mb-12 pb-8 border-b">
                        <h2 className="text-lg font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                            Synopsis
                        </h2>
                        <p className="text-base leading-relaxed">{story.synopsis}</p>
                    </div>
                )}

                {/* Chapters */}
                {sortedChapters.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-muted-foreground">No chapters yet</p>
                    </div>
                ) : (
                    <div className="space-y-12">
                        {sortedChapters.map((chapter, index) => (
                            <ChapterReader key={chapter.id} chapter={chapter} chapterNumber={index + 1} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

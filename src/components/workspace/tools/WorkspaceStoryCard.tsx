import { BookOpen, Edit, FolderUp, Trash2 } from "lucide-react";
import type { MouseEvent } from "react";
import { useNavigate } from "react-router";
import { DownloadMenu } from "@/components/ui/DownloadMenu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ROUTES } from "@/constants/urls";
import { useSingleSeriesQuery } from "@/features/series/hooks/useSeriesQuery";
import { useStoryContext } from "@/features/stories/context/StoryContext";
import { useDeleteStoryMutation } from "@/features/stories/hooks/useStoriesQuery";
import type { Story } from "@/types/story";

interface WorkspaceStoryCardProps {
    story: Story;
    onEdit: (story: Story) => void;
    onExport: (story: Story) => void;
}

export const WorkspaceStoryCard = ({ story, onEdit, onExport }: WorkspaceStoryCardProps) => {
    const deleteStoryMutation = useDeleteStoryMutation();
    const { setCurrentStoryId } = useStoryContext();
    const { data: series } = useSingleSeriesQuery(story.seriesId);
    const navigate = useNavigate();

    const handleDelete = (e: MouseEvent) => {
        e.stopPropagation();
        if (window.confirm("Are you sure you want to delete this story?")) deleteStoryMutation.mutate(story.id);
    };

    const handleEdit = (e: MouseEvent) => {
        e.stopPropagation();
        onEdit(story);
    };

    const handleExport = (e: MouseEvent) => {
        e.stopPropagation();
        onExport(story);
    };

    const handleRead = (e: MouseEvent) => {
        e.stopPropagation();
        navigate(ROUTES.STORY_READER(story.id));
    };

    const handleCardClick = () => {
        setCurrentStoryId(story.id);
    };

    return (
        <Card
            className="w-full cursor-pointer border-2 border-gray-300 dark:border-gray-700 hover:bg-accent hover:text-accent-foreground transition-colors shadow-sm"
            onClick={handleCardClick}
        >
            <CardHeader>
                <CardTitle>{story.title}</CardTitle>
                <CardDescription>
                    {series && (
                        <Badge variant="secondary" className="mb-2">
                            Series: {series.name}
                        </Badge>
                    )}
                    <div>By {story.author}</div>
                </CardDescription>
            </CardHeader>
            <CardContent>{story.synopsis && <p className="text-sm text-muted-foreground">{story.synopsis}</p>}</CardContent>
            <CardFooter className="flex justify-end gap-2">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={handleRead}>
                                <BookOpen className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Read story</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div>
                                <DownloadMenu type="story" id={story.id} />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Download options</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={handleEdit}>
                                <Edit className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Edit story details</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={handleExport}>
                                <FolderUp className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Export story as JSON</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={handleDelete}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Delete story</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </CardFooter>
        </Card>
    );
};

import { BookOpen, Edit, FolderUp, Trash2 } from "lucide-react";
import type { MouseEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { ActionButton } from "@/components/ui/ActionButton";
import { ConfirmDeleteDialog } from "@/components/ui/ConfirmDeleteDialog";
import { DownloadMenu } from "@/components/ui/DownloadMenu";
import { Badge } from "@/components/ui/badge";
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
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    const handleDeleteClick = (e: MouseEvent) => {
        e.stopPropagation();
        setDeleteDialogOpen(true);
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
                <ActionButton icon={BookOpen} tooltip="Read story" onClick={handleRead} />
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
                <ActionButton icon={Edit} tooltip="Edit story details" onClick={handleEdit} />
                <ActionButton icon={FolderUp} tooltip="Export story as JSON" onClick={handleExport} />
                <ActionButton icon={Trash2} tooltip="Delete story" onClick={handleDeleteClick} />
            </CardFooter>
            <ConfirmDeleteDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                description={`Delete "${story.title}"? This action cannot be undone.`}
                onConfirm={() => deleteStoryMutation.mutate(story.id)}
            />
        </Card>
    );
};

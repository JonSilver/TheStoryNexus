import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSeriesQuery } from "@/features/series/hooks/useSeriesQuery";
import { CreateStoryDialog } from "@/features/stories/components/CreateStoryDialog";
import { EditStoryDialog } from "@/features/stories/components/EditStoryDialog";
import { useStoryContext } from "@/features/stories/context/StoryContext";
import { useStoriesQuery } from "@/features/stories/hooks/useStoriesQuery";
import { useDeleteStoryMutation } from "@/features/stories/hooks/useStoriesQuery";
import { adminApi } from "@/services/api/client";
import { storyExportService } from "@/services/storyExportService";
import type { Story } from "@/types/story";
import { logger } from "@/utils/logger";
import { attemptPromise } from "@jfdi/attempt";
import { BookOpen, Download, Upload, Edit, FolderUp, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type ChangeEvent } from "react";
import { toast } from "react-toastify";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DownloadMenu } from "@/components/ui/DownloadMenu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSingleSeriesQuery } from "@/features/series/hooks/useSeriesQuery";
import type { MouseEvent } from "react";
import { useNavigate } from "react-router";
import { ROUTES } from "@/constants/urls";

// Story Card for workspace - clicks story to load it in workspace
function WorkspaceStoryCard({
    story,
    onEdit,
    onExport
}: {
    story: Story;
    onEdit: (story: Story) => void;
    onExport: (story: Story) => void;
}) {
    const deleteStoryMutation = useDeleteStoryMutation();
    const { setCurrentStoryId } = useStoryContext();
    const { data: series } = useSingleSeriesQuery(story.seriesId);
    const navigate = useNavigate();

    const handleDelete = async (e: MouseEvent) => {
        e.stopPropagation();
        if (window.confirm("Are you sure you want to delete this story?")) {
            deleteStoryMutation.mutate(story.id);
        }
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
        // Set story in context, which will switch to editor tool
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
            <CardContent>
                {story.synopsis && <p className="text-sm text-muted-foreground">{story.synopsis}</p>}
            </CardContent>
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
}

export const StoriesTool = () => {
    const queryClient = useQueryClient();
    const { data: stories = [], refetch: fetchStories } = useStoriesQuery();
    const { data: seriesList = [] } = useSeriesQuery();
    const [editingStory, setEditingStory] = useState<Story | null>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [selectedSeriesFilter, setSelectedSeriesFilter] = useState<string>("all");
    const [isImportingDemo, setIsImportingDemo] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleEditStory = (story: Story) => {
        setEditingStory(story);
        setEditDialogOpen(true);
    };

    const handleExportStory = (story: Story) => {
        storyExportService.exportStory(story.id);
    };

    const handleImportClick = () => {
        if (fileInputRef.current) fileInputRef.current.click();
    };

    const handleImportStory = async (event: ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0) return;

        const file = event.target.files[0];

        const [error] = await attemptPromise(async () => {
            await storyExportService.importStory(file);
            await fetchStories();
        });

        if (error) logger.error("Import failed:", error);

        event.target.value = "";
    };

    const handleImportDemoStory = async () => {
        setIsImportingDemo(true);
        const [error] = await attemptPromise(async () => {
            await adminApi.importDemoData();
            await queryClient.invalidateQueries();
        });

        if (error) {
            logger.error("Demo import failed:", error);
            toast.error("Failed to import demo story");
        } else {
            toast.success("Demo story imported successfully");
        }

        setIsImportingDemo(false);
    };

    const filteredStories = stories.filter(story => {
        if (selectedSeriesFilter === "all") return true;
        if (selectedSeriesFilter === "none") return !story.seriesId;
        return story.seriesId === selectedSeriesFilter;
    });

    return (
        <div className="p-8">
            <div className="max-w-7xl mx-auto space-y-12">
                <div className="flex items-center justify-center gap-6 mb-8">
                    <h1 className="text-2xl font-bold">Your Stories</h1>
                    <div className="flex gap-4">
                        <CreateStoryDialog />
                        <Button variant="outline" onClick={handleImportClick}>
                            <Upload className="w-4 h-4 mr-2" />
                            Import Story
                        </Button>
                        <Button variant="ghost" onClick={handleImportDemoStory} disabled={isImportingDemo}>
                            <Download className="w-4 h-4 mr-2" />
                            {isImportingDemo ? "Importing..." : "Import Demo Story"}
                        </Button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".json"
                            className="hidden"
                            onChange={handleImportStory}
                        />
                    </div>
                </div>

                {stories.length > 0 && (
                    <div className="flex justify-center">
                        <div className="flex flex-col gap-2 w-64">
                            <Label htmlFor="series-filter">Filter by Series</Label>
                            <Select value={selectedSeriesFilter} onValueChange={setSelectedSeriesFilter}>
                                <SelectTrigger id="series-filter">
                                    <SelectValue placeholder="All Stories" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Stories</SelectItem>
                                    <SelectItem value="none">No Series</SelectItem>
                                    {seriesList.map(series => (
                                        <SelectItem key={series.id} value={series.id}>
                                            {series.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}

                {stories.length === 0 ? (
                    <div className="text-center text-muted-foreground">
                        No stories yet. Create your first story to get started!
                    </div>
                ) : filteredStories.length === 0 ? (
                    <div className="text-center text-muted-foreground">No stories match the selected filter.</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 place-items-center">
                        {filteredStories.map(story => (
                            <WorkspaceStoryCard
                                key={story.id}
                                story={story}
                                onEdit={handleEditStory}
                                onExport={handleExportStory}
                            />
                        ))}
                    </div>
                )}

                <EditStoryDialog
                    key={editingStory?.id}
                    story={editingStory}
                    open={editDialogOpen}
                    onOpenChange={setEditDialogOpen}
                />
            </div>
        </div>
    );
};

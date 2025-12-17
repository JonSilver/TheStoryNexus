import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSeriesQuery } from "@/features/series/hooks/useSeriesQuery";
import { EditStoryDialog } from "@/features/stories/components/EditStoryDialog";
import { useStoriesQuery } from "@/features/stories/hooks/useStoriesQuery";
import { storyExportService } from "@/services/storyExportService";
import type { Story } from "@/types/story";
import { StoriesToolHeader } from "./StoriesToolHeader";
import { WorkspaceStoryCard } from "./WorkspaceStoryCard";

export const StoriesTool = () => {
    const { data: stories = [], refetch: fetchStories } = useStoriesQuery();
    const { data: seriesList = [] } = useSeriesQuery();
    const [editingStory, setEditingStory] = useState<Story | null>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [selectedSeriesFilter, setSelectedSeriesFilter] = useState<string>("all");

    const handleEditStory = (story: Story) => {
        setEditingStory(story);
        setEditDialogOpen(true);
    };

    const handleExportStory = (story: Story) => {
        storyExportService.exportStory(story.id);
    };

    const filteredStories = stories.filter(story => {
        if (selectedSeriesFilter === "all") return true;
        if (selectedSeriesFilter === "none") return !story.seriesId;
        return story.seriesId === selectedSeriesFilter;
    });

    return (
        <div className="p-4 sm:p-8">
            <div className="max-w-7xl mx-auto space-y-6 sm:space-y-12">
                <StoriesToolHeader onStoriesChange={fetchStories} />

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

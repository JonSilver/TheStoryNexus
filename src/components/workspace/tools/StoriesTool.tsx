import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { SearchFilter } from "@/components/ui/SearchFilter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSeriesQuery } from "@/features/series/hooks/useSeriesQuery";
import { EditStoryDialog } from "@/features/stories/components/EditStoryDialog";
import { useStoriesQuery } from "@/features/stories/hooks/useStoriesQuery";
import { storyExportService } from "@/services/storyExportService";
import type { Story } from "@/types/story";
import { StoriesToolHeader } from "./StoriesToolHeader";
import { WorkspaceStoryCard } from "./WorkspaceStoryCard";

const storyMatchesSearch = (story: Story, term: string) =>
    [story.title, story.author, story.synopsis].some(field => field?.toLowerCase().includes(term));

export const StoriesTool = () => {
    const { data: stories = [], refetch: fetchStories } = useStoriesQuery();
    const { data: seriesList = [] } = useSeriesQuery();
    const [editingStory, setEditingStory] = useState<Story | null>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [selectedSeriesFilter, setSelectedSeriesFilter] = useState<string>("all");

    const seriesFilteredStories = useMemo(
        () =>
            stories.filter(story => {
                if (selectedSeriesFilter === "all") return true;
                if (selectedSeriesFilter === "none") return !story.seriesId;
                return story.seriesId === selectedSeriesFilter;
            }),
        [stories, selectedSeriesFilter]
    );

    const handleEditStory = (story: Story) => {
        setEditingStory(story);
        setEditDialogOpen(true);
    };

    const handleExportStory = (story: Story) => {
        storyExportService.exportStory(story.id);
    };

    return (
        <div className="p-4 sm:p-8">
            <div className="max-w-7xl mx-auto space-y-6 sm:space-y-12">
                <StoriesToolHeader onStoriesChange={fetchStories} />

                {stories.length === 0 ? (
                    <div className="text-center text-muted-foreground">
                        No stories yet. Create your first story to get started!
                    </div>
                ) : (
                    <SearchFilter
                        items={seriesFilteredStories}
                        predicate={storyMatchesSearch}
                        placeholder="Search stories..."
                    >
                        {({ filteredItems, searchInput }) => (
                            <>
                                <div className="flex flex-col sm:flex-row justify-center gap-4 items-center">
                                    {searchInput}
                                    <div className="flex flex-col gap-2 w-64">
                                        <Label htmlFor="series-filter">Filter by Series</Label>
                                        <Select
                                            value={selectedSeriesFilter}
                                            onValueChange={setSelectedSeriesFilter}
                                        >
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
                                {filteredItems.length === 0 ? (
                                    <div className="text-center text-muted-foreground">
                                        No stories match the selected filter.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 place-items-center">
                                        {filteredItems.map(story => (
                                            <WorkspaceStoryCard
                                                key={story.id}
                                                story={story}
                                                onEdit={handleEditStory}
                                                onExport={handleExportStory}
                                            />
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </SearchFilter>
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

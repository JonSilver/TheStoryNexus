import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { LorebookEntry } from "@/types/story";
import { logger } from "@/utils/logger";
import { attempt, attemptPromise } from "@jfdi/attempt";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Plus, Upload } from "lucide-react";
import { useState, type ChangeEvent } from "react";
import { useParams } from "react-router";
import { toast } from "react-toastify";
import { CreateEntryDialog } from "../components/CreateEntryDialog";
import { LorebookEntryList } from "../components/LorebookEntryList";
import { lorebookKeys, useHierarchicalLorebookQuery, useSeriesLorebookQuery } from "../hooks/useLorebookQuery";
import { LorebookImportExportService } from "../stores/LorebookImportExportService";

type LorebookCategory = LorebookEntry["category"];

const CATEGORIES: LorebookCategory[] = [
    "character",
    "location",
    "item",
    "event",
    "note",
    "synopsis",
    "starting scenario",
    "timeline"
];

interface LorebookPageProps {
    storyId?: string;
    seriesId?: string;
}

export default function LorebookPage({ storyId: propStoryId, seriesId: propSeriesId }: LorebookPageProps = {}) {
    const params = useParams<{ storyId?: string; seriesId?: string }>();
    const queryClient = useQueryClient();

    // Use props if provided, otherwise fall back to params
    const storyId = propStoryId ?? params.storyId;
    const seriesId = propSeriesId ?? params.seriesId;

    const [selectedCategory, setSelectedCategory] = useState<LorebookCategory>("character");
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

    // Fetch appropriate entries based on context
    const { data: storyEntries, isLoading: storyLoading } = useHierarchicalLorebookQuery(storyId);
    const { data: seriesEntries, isLoading: seriesLoading } = useSeriesLorebookQuery(seriesId);

    const entries = storyId ? storyEntries || [] : seriesEntries || [];
    const isLoading = storyId ? storyLoading : seriesLoading;

    // Filter by category
    const entriesByCategory = entries.filter(e => e.category === selectedCategory);

    // Calculate category counts from the current entries
    const categoryCounts = entries.reduce(
        (acc, entry) => {
            acc[entry.category] = (acc[entry.category] || 0) + 1;
            return acc;
        },
        {} as Record<LorebookCategory, number>
    );

    // Handle export functionality
    const handleExport = async () => {
        if (storyId) {
            const [error] = attempt(() => LorebookImportExportService.exportEntries(entries, storyId));
            if (error) {
                logger.error("Export failed:", error);
                toast.error("Failed to export lorebook entries");
                return;
            }
            toast.success("Lorebook entries exported successfully");
        }
    };

    // Handle import functionality
    const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0) return;

        const file = event.target.files[0];

        if (storyId) {
            const reader = new FileReader();
            reader.onload = async e => {
                const [error] = await attemptPromise(async () => {
                    const content = e.target?.result as string;
                    await LorebookImportExportService.importEntries(content, storyId, () => {
                        queryClient.invalidateQueries({ queryKey: lorebookKeys.byStory(storyId) });
                    });
                });
                if (error) {
                    logger.error("Import failed:", error);
                    toast.error("Failed to import lorebook entries");
                    return;
                }
                toast.success("Lorebook entries imported successfully");
            };
            reader.readAsText(file);
        }

        // Reset the input
        event.target.value = "";
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Header - stacks on mobile */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold">{seriesId ? "Series Lorebook" : "Story Lorebook"}</h1>
                    <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                        {seriesId
                            ? "Entries shared across all stories in series"
                            : "Story entries (includes global and series)"}
                    </p>
                </div>
                <div className="flex gap-2">
                    {/* Import/Export icons only on mobile */}
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={handleExport}
                        className="sm:hidden border-2 border-gray-300 dark:border-gray-700"
                        title="Export"
                    >
                        <Download className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleExport}
                        className="hidden sm:flex border-2 border-gray-300 dark:border-gray-700"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Export
                    </Button>
                    <label htmlFor="import-lorebook">
                        <Button
                            variant="outline"
                            size="icon"
                            asChild
                            className="sm:hidden border-2 border-gray-300 dark:border-gray-700"
                        >
                            <div title="Import">
                                <Upload className="w-4 h-4" />
                            </div>
                        </Button>
                        <Button variant="outline" asChild className="hidden sm:flex border-2 border-gray-300 dark:border-gray-700">
                            <div>
                                <Upload className="w-4 h-4 mr-2" />
                                Import
                            </div>
                        </Button>
                    </label>
                    <input id="import-lorebook" type="file" accept=".json" className="hidden" onChange={handleImport} />
                    <Button size="icon" className="sm:hidden" onClick={() => setIsCreateDialogOpen(true)} title="New Entry">
                        <Plus className="w-4 h-4" />
                    </Button>
                    <Button className="hidden sm:flex" onClick={() => setIsCreateDialogOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        New Entry
                    </Button>
                </div>
            </div>

            <Separator className="bg-gray-300 dark:bg-gray-700" />

            {/* Category tabs - horizontal scroll on mobile */}
            <Tabs
                value={selectedCategory}
                onValueChange={v => setSelectedCategory(v as LorebookCategory)}
                className="w-full"
            >
                <TabsList className="w-full justify-start bg-gray-100 dark:bg-gray-800 p-1 border border-gray-300 dark:border-gray-700 overflow-x-auto flex-nowrap">
                    {CATEGORIES.map(cat => (
                        <TabsTrigger
                            key={cat}
                            value={cat}
                            className="whitespace-nowrap text-xs sm:text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:border-b-2 data-[state=active]:border-primary"
                        >
                            {cat.charAt(0).toUpperCase() + cat.slice(1)} ({categoryCounts[cat] || 0})
                        </TabsTrigger>
                    ))}
                </TabsList>

                {CATEGORIES.map(cat => (
                    <TabsContent key={cat} value={cat} className="mt-6">
                        {isLoading ? (
                            <div className="flex justify-center p-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                            </div>
                        ) : entriesByCategory.length > 0 ? (
                            <LorebookEntryList
                                entries={entriesByCategory}
                                editable={true}
                                showLevel={true}
                                contextStoryId={storyId}
                            />
                        ) : (
                            <div className="text-center text-muted-foreground py-12">No {cat} entries yet</div>
                        )}
                    </TabsContent>
                ))}
            </Tabs>

            {/* Create dialog */}
            <CreateEntryDialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
                storyId={storyId}
                seriesId={seriesId}
                defaultCategory={selectedCategory}
            />
        </div>
    );
}

import {
    closestCenter,
    DndContext,
    type DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { attemptPromise } from "@jfdi/attempt";
import { useState } from "react";
import { toast } from "react-toastify";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChapterCard } from "@/features/chapters/components/ChapterCard";
import {
    useChaptersByStoryQuery,
    useCreateChapterMutation,
    useUpdateChapterMutation
} from "@/features/chapters/hooks/useChaptersQuery";
import { LorebookProvider } from "@/features/lorebook/context/LorebookContext";
import { useLorebookByStoryQuery } from "@/features/lorebook/hooks/useLorebookQuery";
import { useStoryContext } from "@/features/stories/context/StoryContext";
import type { Chapter } from "@/types/story";
import { logger } from "@/utils/logger";
import { CreateChapterDialog, type CreateChapterForm } from "./CreateChapterDialog";

export const ChaptersTool = () => {
    const { currentStoryId, setCurrentChapterId, setCurrentTool } = useStoryContext();
    const {
        data: chapters = [],
        isLoading: loading,
        error: queryError
    } = useChaptersByStoryQuery(currentStoryId || "");
    const { data: lorebookEntries = [] } = useLorebookByStoryQuery(currentStoryId || "");
    const createChapterMutation = useCreateChapterMutation();
    const updateChapterMutation = useUpdateChapterMutation();
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

    const error = queryError?.message || null;
    const characterEntries = lorebookEntries.filter(entry => entry.category === "character");

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates
        })
    );

    const handleCreateChapter = (data: CreateChapterForm) => {
        if (!currentStoryId) return;

        const nextOrder = chapters.length === 0 ? 1 : Math.max(...chapters.map(chapter => chapter.order ?? 0)) + 1;
        const povCharacter = data.povType !== "Third Person Omniscient" ? data.povCharacter : undefined;

        createChapterMutation.mutate(
            {
                id: "",
                storyId: currentStoryId,
                title: data.title,
                content: "",
                povCharacter,
                povType: data.povType,
                order: nextOrder,
                outline: { content: "", lastUpdated: new Date() },
                wordCount: 0
            },
            {
                onSuccess: () => setIsCreateDialogOpen(false)
            }
        );
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        const activeId = active.id.toString();
        const overId = over?.id.toString();

        if (!over || activeId === overId) return;

        const oldIndex = chapters.findIndex(chapter => chapter.id === activeId);
        const newIndex = chapters.findIndex(chapter => chapter.id === overId);

        if (oldIndex === -1 || newIndex === -1) return;

        const updatedChapters = arrayMove(chapters, oldIndex, newIndex);

        const [reorderError] = await attemptPromise(async () => {
            await Promise.all(
                updatedChapters.map((chapter: Chapter, index) =>
                    updateChapterMutation.mutateAsync({
                        id: chapter.id,
                        data: { order: index + 1 }
                    })
                )
            );
        });

        if (reorderError) {
            logger.error("Failed to update chapter order:", reorderError);
            toast.error("Failed to update chapter order");
        }
    };

    const handleWriteClick = (chapterId: string) => {
        setCurrentChapterId(chapterId);
        setCurrentTool("editor");
    };

    if (!currentStoryId)
        return (
            <div className="h-full flex items-center justify-center">
                <p className="text-muted-foreground">No story selected</p>
            </div>
        );

    if (loading)
        return (
            <div className="h-full flex items-center justify-center">
                <p className="text-muted-foreground">Loading chapters...</p>
            </div>
        );

    if (error)
        return (
            <div className="h-full flex items-center justify-center">
                <p className="text-destructive">{error}</p>
            </div>
        );

    return (
        <LorebookProvider storyId={currentStoryId}>
            <div className="container mx-auto max-w-4xl px-3 sm:px-6 py-4 sm:py-6">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold">Chapters</h1>
                    <CreateChapterDialog
                        open={isCreateDialogOpen}
                        onOpenChange={setIsCreateDialogOpen}
                        characterEntries={characterEntries}
                        onSubmit={handleCreateChapter}
                    />
                </div>

                <ScrollArea className="h-[calc(100vh-10rem)]">
                    {chapters.length === 0 ? (
                        <EmptyState
                            message="No chapters yet. Start writing your story by creating a new chapter."
                            actionLabel="Create First Chapter"
                            onAction={() => setIsCreateDialogOpen(true)}
                        />
                    ) : (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext
                                items={chapters.map(chapter => chapter.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="space-y-2">
                                    {chapters
                                        .sort((a, b) => a.order - b.order)
                                        .map(chapter => (
                                            <ChapterCard
                                                key={chapter.id}
                                                chapter={chapter}
                                                storyId={currentStoryId}
                                                onWriteClick={() => handleWriteClick(chapter.id)}
                                            />
                                        ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    )}
                </ScrollArea>
            </div>
        </LorebookProvider>
    );
};

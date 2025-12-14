import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChapterCard } from "@/features/chapters/components/ChapterCard";
import {
    useChaptersByStoryQuery,
    useCreateChapterMutation,
    useUpdateChapterMutation
} from "@/features/chapters/hooks/useChaptersQuery";
import { useLorebookByStoryQuery } from "@/features/lorebook/hooks/useLorebookQuery";
import { LorebookProvider } from "@/features/lorebook/context/LorebookContext";
import { useStoryContext } from "@/features/stories/context/StoryContext";
import { Chapter } from "@/types/story";
import { logger } from "@/utils/logger";
import {
    closestCenter,
    DndContext,
    DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { attemptPromise } from "@jfdi/attempt";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";

type POVType = "First Person" | "Third Person Limited" | "Third Person Omniscient";

interface CreateChapterForm {
    title: string;
    povCharacter?: string;
    povType?: POVType;
}

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
    const form = useForm<CreateChapterForm>({
        defaultValues: {
            povType: "Third Person Omniscient"
        }
    });

    const error = queryError?.message || null;

    const povType = form.watch("povType");
    const characterEntries = lorebookEntries.filter(entry => entry.category === "character");

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates
        })
    );

    const handlePovTypeChange = (value: string) => {
        form.setValue("povType", value as POVType);
        // Clear POV character when switching to omniscient
        if (value === "Third Person Omniscient") {
            form.setValue("povCharacter", undefined);
        }
    };

    const handleCreateChapter = (data: CreateChapterForm) => {
        if (!currentStoryId) return;

        const nextOrder = chapters.length === 0 ? 1 : Math.max(...chapters.map(chapter => chapter.order ?? 0)) + 1;

        // Only include povCharacter if not omniscient
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
                onSuccess: () => {
                    setIsCreateDialogOpen(false);
                    form.reset({
                        title: "",
                        povType: "Third Person Omniscient",
                        povCharacter: undefined
                    });
                }
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

        // Update all chapters with new order
        const [error] = await attemptPromise(async () => {
            await Promise.all(
                updatedChapters.map((chapter: Chapter, index) =>
                    updateChapterMutation.mutateAsync({
                        id: chapter.id,
                        data: { order: index + 1 }
                    })
                )
            );
        });

        if (error) {
            logger.error("Failed to update chapter order:", error);
            toast.error("Failed to update chapter order");
        }
    };

    const handleWriteClick = (chapterId: string) => {
        setCurrentChapterId(chapterId);
        setCurrentTool("editor");
    };

    if (!currentStoryId) {
        return (
            <div className="h-full flex items-center justify-center">
                <p className="text-muted-foreground">No story selected</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <p className="text-muted-foreground">Loading chapters...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-full flex items-center justify-center">
                <p className="text-destructive">{error}</p>
            </div>
        );
    }

    return (
        <LorebookProvider storyId={currentStoryId}>
            <div className="container mx-auto max-w-4xl p-6">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-3xl font-bold">Chapters</h1>
                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="h-4 w-4 mr-2" />
                                New Chapter
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <form onSubmit={form.handleSubmit(handleCreateChapter)}>
                                <DialogHeader>
                                    <DialogTitle>Create New Chapter</DialogTitle>
                                    <DialogDescription>
                                        Add a new chapter to your story. You can edit the content after creating it.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="title">Title</Label>
                                        <Input
                                            id="title"
                                            placeholder="Enter chapter title"
                                            {...form.register("title", { required: true })}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="povType">POV Type</Label>
                                        <Select
                                            defaultValue="Third Person Omniscient"
                                            onValueChange={handlePovTypeChange}
                                        >
                                            <SelectTrigger id="povType">
                                                <SelectValue placeholder="Select POV type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="First Person">First Person</SelectItem>
                                                <SelectItem value="Third Person Limited">
                                                    Third Person Limited
                                                </SelectItem>
                                                <SelectItem value="Third Person Omniscient">
                                                    Third Person Omniscient
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {povType && povType !== "Third Person Omniscient" && (
                                        <div className="grid gap-2">
                                            <Label htmlFor="povCharacter">POV Character</Label>
                                            <Select onValueChange={value => form.setValue("povCharacter", value)}>
                                                <SelectTrigger id="povCharacter">
                                                    <SelectValue placeholder="Select character" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {characterEntries.length === 0 ? (
                                                        <SelectItem value="none" disabled>
                                                            No characters available
                                                        </SelectItem>
                                                    ) : (
                                                        characterEntries.map(character => (
                                                            <SelectItem key={character.id} value={character.name}>
                                                                {character.name}
                                                            </SelectItem>
                                                        ))
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>
                                <DialogFooter>
                                    <Button type="submit">Create Chapter</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                <ScrollArea className="h-[calc(100vh-10rem)]">
                    {chapters.length === 0 ? (
                        <div className="h-[200px] flex flex-col items-center justify-center text-center p-6">
                            <p className="text-muted-foreground mb-4">
                                No chapters yet. Start writing your story by creating a new chapter.
                            </p>
                            <Button onClick={() => setIsCreateDialogOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Create First Chapter
                            </Button>
                        </div>
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

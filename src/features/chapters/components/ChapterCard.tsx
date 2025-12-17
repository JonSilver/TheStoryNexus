import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical, Pencil, PenLine, Trash2 } from "lucide-react";
import { type MouseEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ROUTES } from "@/constants/urls";
import { useDeleteChapterMutation, useUpdateChapterMutation } from "@/features/chapters/hooks/useChaptersQuery";
import { useLorebookContext } from "@/features/lorebook/context/LorebookContext";
import { useStoryContext } from "@/features/stories/context/StoryContext";
import { parseLocalStorage } from "@/schemas/entities";
import type { Chapter } from "@/types/story";
import { ChapterSummarySection } from "./ChapterSummarySection";
import { DeleteChapterDialog } from "./DeleteChapterDialog";
import { EditChapterDialog } from "./EditChapterDialog";

type POVType = "First Person" | "Third Person Limited" | "Third Person Omniscient";

interface EditChapterForm {
    title: string;
    povCharacter?: string;
    povType?: POVType;
}

interface ChapterCardProps {
    chapter: Chapter;
    storyId: string;
    onWriteClick?: () => void;
}

export function ChapterCard({ chapter, storyId, onWriteClick }: ChapterCardProps) {
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const expandedStateKey = `chapter-${chapter.id}-expanded`;
    const [isExpanded, setIsExpanded] = useState(() => parseLocalStorage(z.boolean(), expandedStateKey, false));

    const deleteChapterMutation = useDeleteChapterMutation();
    const updateChapterMutation = useUpdateChapterMutation();
    const { setCurrentChapterId } = useStoryContext();
    const navigate = useNavigate();
    const { entries } = useLorebookContext();
    const characterEntries = entries.filter(entry => entry.category === "character");

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: chapter.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1
    };

    useEffect(() => {
        localStorage.setItem(expandedStateKey, JSON.stringify(isExpanded));
    }, [isExpanded, expandedStateKey]);

    const handleDelete = () => {
        deleteChapterMutation.mutate(chapter.id, {
            onSuccess: () => setShowDeleteDialog(false)
        });
    };

    const handleEdit = (data: EditChapterForm) => {
        updateChapterMutation.mutate(
            { id: chapter.id, data },
            { onSuccess: () => setShowEditDialog(false) }
        );
    };

    const toggleExpanded = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsExpanded((prev: boolean) => !prev);
    };

    const handleWriteClick = () => {
        if (onWriteClick) onWriteClick();
        else {
            setCurrentChapterId(chapter.id);
            navigate(ROUTES.DASHBOARD.CHAPTER_EDITOR(storyId, chapter.id));
        }
    };

    return (
        <div ref={setNodeRef} style={style}>
            <Card className="w-full">
                <CardHeader className="p-3 sm:p-4">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 flex items-center gap-1 sm:gap-2 min-w-0">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="cursor-grab active:cursor-grabbing shrink-0 h-8 w-8 p-0"
                                {...attributes}
                                {...listeners}
                            >
                                <GripVertical className="h-4 w-4" />
                            </Button>
                            <div className="min-w-0">
                                <h3 className="text-base sm:text-lg font-semibold truncate">
                                    {chapter.order}: {chapter.title}
                                </h3>
                                {(chapter.povCharacter || chapter.povType) && (
                                    <span className="text-xs text-muted-foreground block truncate">
                                        POV:{" "}
                                        {chapter.povCharacter
                                            ? `${chapter.povCharacter} (${chapter.povType})`
                                            : chapter.povType}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowEditDialog(true)}>
                                <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleWriteClick}>
                                <PenLine className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setShowDeleteDialog(true)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleExpanded}>
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                {isExpanded && (
                    <CardContent className="p-4">
                        <ChapterSummarySection chapter={chapter} storyId={storyId} />
                    </CardContent>
                )}
            </Card>

            <DeleteChapterDialog
                open={showDeleteDialog}
                onOpenChange={setShowDeleteDialog}
                chapterOrder={chapter.order}
                chapterTitle={chapter.title}
                onDelete={handleDelete}
            />

            <EditChapterDialog
                open={showEditDialog}
                onOpenChange={setShowEditDialog}
                chapter={chapter}
                characterEntries={characterEntries}
                onSubmit={handleEdit}
            />
        </div>
    );
}

import { AIGenerateMenu } from "@/components/ui/ai-generate-menu";
import { DownloadMenu } from "@/components/ui/DownloadMenu";
import { ROUTES } from "@/constants/urls";
import { useGenerateWithPrompt } from "@/features/ai/hooks/useGenerateWithPrompt";
import { useDeleteChapterMutation, useUpdateChapterMutation } from "@/features/chapters/hooks/useChaptersQuery";
import { useLorebookContext } from "@/features/lorebook/context/LorebookContext";
import { useLastUsedPrompt } from "@/features/prompts/hooks/useLastUsedPrompt";
import { usePromptsQuery } from "@/features/prompts/hooks/usePromptsQuery";
import { useStoryContext } from "@/features/stories/context/StoryContext";
import { parseLocalStorage } from "@/schemas/entities";
import { aiService } from "@/services/ai/AIService";
import { chaptersApi } from "@/services/api/client";
import { PromptParserConfig } from "@/types/story";
import { extractPlainTextFromLexical } from "@/utils/lexicalUtils";
import { logger } from "@/utils/logger";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { attemptPromise } from "@jfdi/attempt";
import { ChevronDown, ChevronUp, GripVertical, Pencil, PenLine, Trash2 } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { toast } from "react-toastify";
import { z } from "zod";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from "../../../components/ui/alert-dialog";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../../components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import type { AllowedModel, Chapter, Prompt } from "../../../types/story";

interface ChapterCardProps {
    chapter: Chapter;
    storyId: string;
    onWriteClick?: () => void;
}

type POVType = "First Person" | "Third Person Limited" | "Third Person Omniscient";

interface EditChapterForm {
    title: string;
    povCharacter?: string;
    povType?: POVType;
}

export function ChapterCard({ chapter, storyId, onWriteClick }: ChapterCardProps) {
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const expandedStateKey = `chapter-${chapter.id}-expanded`;
    const [isExpanded, setIsExpanded] = useState(() => parseLocalStorage(z.boolean(), expandedStateKey, false));
    const [summary, setSummary] = useState(chapter.summary || "");
    const deleteChapterMutation = useDeleteChapterMutation();
    const updateChapterMutation = useUpdateChapterMutation();
    const form = useForm<EditChapterForm>({
        defaultValues: {
            title: chapter.title,
            povCharacter: chapter.povCharacter,
            povType: chapter.povType || "Third Person Omniscient"
        }
    });
    const povType = form.watch("povType");
    const { setCurrentChapterId } = useStoryContext();
    const navigate = useNavigate();
    const { generateWithPrompt } = useGenerateWithPrompt();
    const { entries } = useLorebookContext();
    const { data: prompts = [], isLoading, error: queryError } = usePromptsQuery({ includeSystem: true });
    const { lastUsed, saveSelection } = useLastUsedPrompt("gen_summary", prompts);
    const [isGenerating, setIsGenerating] = useState(false);
    const characterEntries = entries.filter(entry => entry.category === "character");
    const error = queryError?.message ?? null;
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: chapter.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1
    };

    const adjustTextareaHeight = useCallback(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = "auto";
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, []);

    // Adjust textarea height when expanded or summary changes
    useLayoutEffect(() => {
        if (isExpanded) adjustTextareaHeight();
    }, [isExpanded, adjustTextareaHeight]);

    // Save expanded state to localStorage
    useEffect(() => {
        localStorage.setItem(expandedStateKey, JSON.stringify(isExpanded));
    }, [isExpanded, expandedStateKey]);

    const handleDelete = () => {
        deleteChapterMutation.mutate(chapter.id, {
            onSuccess: () => {
                setShowDeleteDialog(false);
            }
        });
    };

    const handleEdit = (data: EditChapterForm) => {
        // Only include povCharacter if not omniscient
        const povCharacter = data.povType !== "Third Person Omniscient" ? data.povCharacter : undefined;

        updateChapterMutation.mutate(
            {
                id: chapter.id,
                data: {
                    ...data,
                    povCharacter
                }
            },
            {
                onSuccess: () => {
                    setShowEditDialog(false);
                }
            }
        );
    };

    const handleSaveSummary = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (summary !== chapter.summary) {
            updateChapterMutation.mutate(
                {
                    id: chapter.id,
                    data: { summary }
                },
                {
                    onSuccess: () => {
                        toast.success("Summary saved successfully");
                    }
                }
            );
        }
    };

    const handleGenerateSummary = async (prompt: Prompt, model: AllowedModel) => {
        saveSelection(prompt, model);
        setIsGenerating(true);

        const [error] = await attemptPromise(async () => {
            const chapterData = await chaptersApi.getById(chapter.id);
            const plainTextContent = chapterData?.content ? extractPlainTextFromLexical(chapterData.content) : "";

            const config: PromptParserConfig = {
                promptId: prompt.id,
                storyId: storyId,
                chapterId: chapter.id,
                additionalContext: {
                    plainTextContent
                }
            };

            const response = await generateWithPrompt(config, model);
            let text = "";

            await new Promise<void>((resolve, reject) => {
                aiService.processStreamedResponse(
                    response,
                    token => {
                        text += token;
                        setSummary(text);
                    },
                    resolve,
                    reject
                );
            });

            updateChapterMutation.mutate({
                id: chapter.id,
                data: { summary: text }
            });
            toast.success("Summary generated successfully");
        });

        if (error) {
            logger.error("Failed to generate summary:", error);
            toast.error("Failed to generate summary");
        }

        setIsGenerating(false);
    };

    const toggleExpanded = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsExpanded((prev: boolean) => !prev);
    };

    const handleWriteClick = () => {
        if (onWriteClick) {
            onWriteClick();
        } else {
            setCurrentChapterId(chapter.id);
            navigate(ROUTES.DASHBOARD.CHAPTER_EDITOR(storyId, chapter.id));
        }
    };

    return (
        <div ref={setNodeRef} style={style}>
            <Card className="w-full">
                <CardHeader className="p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex-1 flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="cursor-grab active:cursor-grabbing"
                                {...attributes}
                                {...listeners}
                            >
                                <GripVertical className="h-4 w-4" />
                            </Button>
                            <h3 className="text-lg font-semibold">
                                {chapter.order}: {chapter.title}
                            </h3>
                            {chapter.povCharacter && (
                                <span className="text-xs text-muted-foreground">
                                    POV: {chapter.povCharacter} ({chapter.povType})
                                </span>
                            )}
                            {!chapter.povCharacter && chapter.povType && (
                                <span className="text-xs text-muted-foreground">POV: {chapter.povType}</span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setShowEditDialog(true)}>
                                <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={handleWriteClick}>
                                <PenLine className="h-4 w-4 mr-2" />
                                Write
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setShowDeleteDialog(true)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={toggleExpanded}>
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                {isExpanded && (
                    <CardContent className="p-4">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor={`summary-${chapter.id}`}>Chapter Summary</Label>
                                <Textarea
                                    ref={textareaRef}
                                    id={`summary-${chapter.id}`}
                                    placeholder="Enter a brief summary of this chapter..."
                                    value={summary}
                                    onChange={e => {
                                        setSummary(e.target.value);
                                    }}
                                    className="min-h-[100px] overflow-hidden"
                                />
                                <div className="flex justify-between items-center">
                                    <Button type="button" variant="secondary" size="sm" onClick={handleSaveSummary}>
                                        Save Summary
                                    </Button>
                                    <AIGenerateMenu
                                        isGenerating={isGenerating}
                                        isLoading={isLoading}
                                        error={error}
                                        prompts={prompts}
                                        promptType="gen_summary"
                                        buttonText="Generate Summary"
                                        onGenerate={handleGenerateSummary}
                                        lastUsed={lastUsed}
                                    />
                                </div>
                                <div className="flex justify-end gap-2 pt-3 border-t">
                                    <DownloadMenu type="chapter" id={chapter.id} />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                )}
            </Card>

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete Chapter {chapter.order}: {chapter.title}. This action cannot be
                            undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent>
                    <form onSubmit={form.handleSubmit(handleEdit)}>
                        <DialogHeader>
                            <DialogTitle>Edit Chapter</DialogTitle>
                            <DialogDescription>Make changes to your chapter details.</DialogDescription>
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
                                    defaultValue={chapter.povType || "Third Person Omniscient"}
                                    onValueChange={value => {
                                        form.setValue("povType", value as POVType);
                                        if (value === "Third Person Omniscient")
                                            form.setValue("povCharacter", undefined);
                                    }}
                                >
                                    <SelectTrigger id="povType">
                                        <SelectValue placeholder="Select POV type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="First Person">First Person</SelectItem>
                                        <SelectItem value="Third Person Limited">Third Person Limited</SelectItem>
                                        <SelectItem value="Third Person Omniscient">Third Person Omniscient</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {povType && povType !== "Third Person Omniscient" && (
                                <div className="grid gap-2">
                                    <Label htmlFor="povCharacter">POV Character</Label>
                                    <Select
                                        value={form.getValues("povCharacter")}
                                        onValueChange={value => form.setValue("povCharacter", value)}
                                    >
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
                            <Button type="submit">Save Changes</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}

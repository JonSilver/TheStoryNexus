import { ChevronDown, ChevronRight, Copy, Trash2 } from "lucide-react";
import { type MouseEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Prompt } from "@/types/story";
import { useClonePromptMutation, useDeletePromptMutation, usePromptsQuery } from "../hooks/usePromptsQuery";

interface PromptsListProps {
    onPromptSelect: (prompt: Prompt) => void;
    selectedPromptId?: string;
    onPromptDelete: (promptId: string) => void;
    filterByType?: Prompt["promptType"];
}

const getPromptTypeLabel = (type: Prompt["promptType"]) => {
    const labels: Record<Prompt["promptType"], string> = {
        scene_beat: "Scene Beat",
        gen_summary: "Generate Summary",
        selection_specific: "Selection-Specific",
        continue_writing: "Continue Writing",
        brainstorm: "Brainstorm",
        other: "Other"
    };
    return labels[type];
};

// Define order for prompt types to display
const promptTypeOrder: Prompt["promptType"][] = [
    "scene_beat",
    "continue_writing",
    "selection_specific",
    "gen_summary",
    "brainstorm",
    "other"
];

export function PromptsList({ onPromptSelect, selectedPromptId, onPromptDelete, filterByType }: PromptsListProps) {
    const { data: prompts = [], isLoading } = usePromptsQuery({ includeSystem: true });
    const deletePromptMutation = useDeletePromptMutation();
    const clonePromptMutation = useClonePromptMutation();

    // Filter prompts by type if specified
    const filteredPrompts = filterByType ? prompts.filter(p => p.promptType === filterByType) : prompts;
    // Track which groups are expanded (default all expanded)
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
        const initialExpandState: Record<string, boolean> = {};
        promptTypeOrder.forEach(type => {
            initialExpandState[type] = true;
        });
        return initialExpandState;
    });

    const toggleGroup = (promptType: string) => {
        setExpandedGroups(prev => ({
            ...prev,
            [promptType]: !prev[promptType]
        }));
    };

    const handleDelete = (e: MouseEvent, promptId: string) => {
        e.stopPropagation();
        deletePromptMutation.mutate(promptId, {
            onSuccess: () => {
                onPromptDelete(promptId);
            }
        });
    };

    const handleClone = (e: MouseEvent, promptId: string) => {
        e.stopPropagation();
        clonePromptMutation.mutate(promptId);
    };

    if (isLoading) return <div className="p-4 text-muted-foreground h-full">Loading prompts...</div>;

    if (!filteredPrompts.length) {
        return (
            <div className="p-4 text-muted-foreground h-full">
                {filterByType ? `No ${getPromptTypeLabel(filterByType)} prompts available` : "No prompts available"}
            </div>
        );
    }

    // Group prompts by promptType
    const groupedPrompts = filteredPrompts.reduce(
        (acc, prompt) => {
            if (!acc[prompt.promptType]) acc[prompt.promptType] = [];

            acc[prompt.promptType].push(prompt);
            return acc;
        },
        {} as Record<Prompt["promptType"], Prompt[]>
    );

    return (
        <div className="h-full overflow-auto">
            {promptTypeOrder.map(promptType => {
                const promptsInGroup = groupedPrompts[promptType] || [];
                if (promptsInGroup.length === 0) return null;

                const isExpanded = expandedGroups[promptType] ?? true;

                return (
                    <div key={promptType} className="mb-2">
                        <button
                            type="button"
                            onClick={() => toggleGroup(promptType)}
                            className="w-full px-4 py-2.5 bg-slate-300 dark:bg-slate-700 font-medium text-sm sticky top-0 shadow-sm border-b border-slate-500 dark:border-slate-600 flex items-center justify-between z-10 text-slate-800 dark:text-white hover:bg-slate-500 dark:hover:bg-slate-600 transition-colors cursor-pointer"
                        >
                            <div className="flex items-center">
                                {isExpanded ? (
                                    <ChevronDown className="h-4 w-4 mr-1.5" />
                                ) : (
                                    <ChevronRight className="h-4 w-4 mr-1.5" />
                                )}
                                {getPromptTypeLabel(promptType)}
                                <span className="ml-2 px-2 py-0.5 text-xs bg-slate-200 dark:bg-slate-500 text-slate-800 dark:text-white rounded-full font-semibold">
                                    {promptsInGroup.length}
                                </span>
                            </div>
                        </button>
                        {isExpanded && (
                            <div className="divide-y divide-border">
                                {promptsInGroup.map(prompt => (
                                    <div
                                        key={prompt.id}
                                        className={cn(
                                            "group relative",
                                            selectedPromptId === prompt.id &&
                                                "bg-muted border-l-2 border-emerald-600 dark:border-emerald-400"
                                        )}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => onPromptSelect(prompt)}
                                            className={cn(
                                                "w-full text-left p-4 hover:bg-muted transition-colors",
                                                "focus:outline-none focus:bg-muted"
                                            )}
                                        >
                                            <div className="flex items-center">
                                                <h3
                                                    className={cn(
                                                        "font-medium",
                                                        selectedPromptId === prompt.id
                                                            ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                                                            : "text-foreground"
                                                    )}
                                                >
                                                    {prompt.name}
                                                </h3>
                                                {prompt.isSystem && (
                                                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                                                        System
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs text-muted-foreground">
                                                    {prompt.messages.length} messages
                                                </span>
                                            </div>
                                        </button>

                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-primary hover:text-primary"
                                                onClick={e => handleClone(e, prompt.id)}
                                                title="Clone prompt"
                                            >
                                                <Copy className="h-4 w-4" />
                                            </Button>

                                            {!prompt.isSystem && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-destructive hover:text-destructive"
                                                    onClick={e => handleDelete(e, prompt.id)}
                                                    title="Delete prompt"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

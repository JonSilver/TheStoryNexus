import { attemptPromise } from "@jfdi/attempt";
import type { FormEvent } from "react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Prompt } from "@/types/story";
import { useModelSelection } from "../hooks/useModelSelection";
import { usePromptFormState } from "../hooks/usePromptFormState";
import { usePromptMessages } from "../hooks/usePromptMessages";
import { useCreatePromptMutation, useUpdatePromptMutation } from "../hooks/usePromptsQuery";
import { MessageEditor } from "./MessageEditor";
import { ModelSelector } from "./ModelSelector";
import { PromptSettings } from "./PromptSettings";

type PromptType = Prompt["promptType"];

const PROMPT_TYPES: Array<{ value: PromptType; label: string }> = [
    { value: "scene_beat", label: "Scene Beat" },
    { value: "gen_summary", label: "Generate Summary" },
    { value: "selection_specific", label: "Selection-Specific" },
    { value: "continue_writing", label: "Continue Writing" },
    { value: "brainstorm", label: "Brainstorm" },
    { value: "other", label: "Other" }
];

interface PromptFormProps {
    prompt?: Prompt;
    onSave?: () => void;
    onCancel?: () => void;
    fixedType?: PromptType;
}

const validateForm = (
    name: string,
    messages: Array<{ content: string }>,
    selectedModels: Array<{ id: string }>
): string | null => {
    if (!name.trim()) return "Please enter a prompt name";
    if (messages.some(msg => !msg.content.trim())) return "All messages must have content";
    if (selectedModels.length === 0) return "Please select at least one AI model";
    return null;
};

export function PromptForm({ prompt, onSave, onCancel, fixedType }: PromptFormProps) {
    const formState = usePromptFormState({ prompt, fixedType });
    const modelSelection = useModelSelection({ initialModels: prompt?.allowedModels });
    const messageHandlers = usePromptMessages({ initialMessages: prompt?.messages });

    const createPromptMutation = useCreatePromptMutation();
    const updatePromptMutation = useUpdatePromptMutation();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        const error = validateForm(formState.name, messageHandlers.messages, modelSelection.selectedModels);
        if (error) {
            toast.error(error);
            return;
        }

        const promptData = {
            name: formState.name,
            messages: messageHandlers.getMessagesWithoutIds(),
            promptType: formState.promptType,
            allowedModels: modelSelection.selectedModels,
            temperature: formState.temperature,
            maxTokens: formState.maxTokens,
            top_p: formState.topP,
            top_k: formState.topK,
            repetition_penalty: formState.repetitionPenalty,
            min_p: formState.minP
        };

        const [saveError] = await attemptPromise(async () => {
            if (prompt?.id) await updatePromptMutation.mutateAsync({ id: prompt.id, data: promptData });
            else await createPromptMutation.mutateAsync(promptData);
            onSave?.();
        });
        if (saveError) toast.error((saveError as Error).message || "Failed to save prompt");
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <Input placeholder="Prompt name" value={formState.name} onChange={e => formState.setName(e.target.value)} />

            <MessageEditor messageHandlers={messageHandlers} />

            <ModelSelector modelSelection={modelSelection} />

            <div className="border-t border-input pt-6">
                <h3 className="font-medium mb-4">Prompt Type</h3>
                <Select
                    value={formState.promptType}
                    onValueChange={(value: PromptType) => formState.setPromptType(value)}
                    disabled={!!fixedType}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select prompt type" />
                    </SelectTrigger>
                    <SelectContent>
                        {PROMPT_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                                {type.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {fixedType && <p className="text-xs text-muted-foreground mt-2">Prompt type is fixed for this context</p>}
            </div>

            <PromptSettings formState={formState} />

            <div className="flex gap-2">
                {onCancel && (
                    <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
                        Cancel
                    </Button>
                )}
                <Button type="submit" className="flex-1">
                    {prompt ? "Update Prompt" : "Create Prompt"}
                </Button>
            </div>
        </form>
    );
}

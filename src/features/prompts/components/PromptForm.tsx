import { attemptPromise } from "@jfdi/attempt";
import { ArrowDown, ArrowUp, Plus, Trash2, Wand2, X } from "lucide-react";
import type { FormEvent } from "react";
import { toast } from "react-toastify";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import type { Prompt } from "@/types/story";
import { useModelSelection } from "../hooks/useModelSelection";
import { usePromptFormState } from "../hooks/usePromptFormState";
import { usePromptMessages } from "../hooks/usePromptMessages";
import { useCreatePromptMutation, useUpdatePromptMutation } from "../hooks/usePromptsQuery";

type PromptType = Prompt["promptType"];

const PROMPT_TYPES: Array<{ value: PromptType; label: string }> = [
    { value: "scene_beat", label: "Scene Beat" },
    { value: "gen_summary", label: "Generate Summary" },
    { value: "selection_specific", label: "Selection-Specific" },
    { value: "continue_writing", label: "Continue Writing" },
    { value: "brainstorm", label: "Brainstorm" },
    { value: "other", label: "Other" }
] as const;

interface PromptFormProps {
    prompt?: Prompt;
    onSave?: () => void;
    onCancel?: () => void;
    fixedType?: PromptType;
}

export function PromptForm({ prompt, onSave, onCancel, fixedType }: PromptFormProps) {
    const formState = usePromptFormState({ prompt, fixedType });
    const modelSelection = useModelSelection({ initialModels: prompt?.allowedModels });
    const messageHandlers = usePromptMessages({ initialMessages: prompt?.messages });

    const createPromptMutation = useCreatePromptMutation();
    const updatePromptMutation = useUpdatePromptMutation();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (!formState.name.trim()) {
            toast.error("Please enter a prompt name");
            return;
        }

        if (messageHandlers.messages.some(msg => !msg.content.trim())) {
            toast.error("All messages must have content");
            return;
        }

        if (modelSelection.selectedModels.length === 0) {
            toast.error("Please select at least one AI model");
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

        const [error] = await attemptPromise(async () => {
            if (prompt?.id) {
                await updatePromptMutation.mutateAsync({
                    id: prompt.id,
                    data: promptData
                });
            } else await createPromptMutation.mutateAsync(promptData);

            onSave?.();
        });
        if (error) toast.error((error as Error).message || "Failed to save prompt");
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <Input placeholder="Prompt name" value={formState.name} onChange={e => formState.setName(e.target.value)} />

            <div className="space-y-4">
                {messageHandlers.messages.map((message, index) => (
                    <div key={message._id} className="space-y-2 p-4 border rounded-lg">
                        <div className="flex items-center justify-between gap-2">
                            <Select
                                value={message.role}
                                onValueChange={(value: "system" | "user" | "assistant") => {
                                    messageHandlers.updateMessage(index, { role: value });
                                }}
                            >
                                <SelectTrigger className="w-[150px]">
                                    <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="system">System</SelectItem>
                                    <SelectItem value="user">User</SelectItem>
                                    <SelectItem value="assistant">Assistant</SelectItem>
                                </SelectContent>
                            </Select>

                            <div className="flex items-center gap-1">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => messageHandlers.moveMessage(index, "up")}
                                    disabled={index === 0}
                                >
                                    <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => messageHandlers.moveMessage(index, "down")}
                                    disabled={index === messageHandlers.messages.length - 1}
                                >
                                    <ArrowDown className="h-4 w-4" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => messageHandlers.removeMessage(index)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        <Textarea
                            value={message.content}
                            onChange={e => {
                                messageHandlers.updateMessage(index, { content: e.target.value });
                            }}
                            placeholder={`Enter ${message.role} message...`}
                            className="min-h-[200px] font-mono"
                        />
                    </div>
                ))}
            </div>

            <div className="flex gap-2">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => messageHandlers.addMessage("system")}
                    className="flex items-center gap-2"
                >
                    <Plus className="h-4 w-4" />
                    System
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => messageHandlers.addMessage("user")}
                    className="flex items-center gap-2"
                >
                    <Plus className="h-4 w-4" />
                    User
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => messageHandlers.addMessage("assistant")}
                    className="flex items-center gap-2"
                >
                    <Plus className="h-4 w-4" />
                    Assistant
                </Button>
            </div>

            <div className="border-t border-input pt-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium">Available Models</h3>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={modelSelection.handleUseDefaultModels}
                        className="flex items-center gap-2"
                    >
                        <Wand2 className="h-4 w-4" />
                        Use Default Models
                    </Button>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                    {modelSelection.selectedModels.map(model => (
                        <Badge key={model.id} variant="secondary" className="flex items-center gap-1 px-3 py-1">
                            {model.name}
                            <button
                                type="button"
                                onClick={() => modelSelection.removeModel(model.id)}
                                className="ml-1 hover:text-destructive"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    ))}
                </div>

                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full text-left">
                            {modelSelection.selectedModels.length
                                ? `${modelSelection.selectedModels.length} selected`
                                : "Select a model"}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-96">
                        <div className="flex flex-col">
                            <Input
                                placeholder="Search models..."
                                value={modelSelection.modelSearch}
                                onChange={e => modelSelection.setModelSearch(e.target.value)}
                                className="mb-2"
                                
                            />

                            <div className="max-h-64 overflow-auto">
                                {Object.keys(modelSelection.filteredModelGroups).length === 0 && (
                                    <div className="p-2 text-sm text-muted-foreground">No models found</div>
                                )}
                                {Object.entries(modelSelection.filteredModelGroups).map(([provider, models]) => (
                                    <div key={provider} className="pb-2">
                                        <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground bg-muted">
                                            {provider}
                                        </div>
                                        {models.map(model => (
                                            <div
                                                key={model.id}
                                                role="option"
                                                tabIndex={0}
                                                aria-selected={modelSelection.selectedModels.some(m => m.id === model.id)}
                                                className={`px-2 py-1 hover:bg-accent hover:text-accent-foreground cursor-pointer ${modelSelection.selectedModels.some(m => m.id === model.id) ? "opacity-50 pointer-events-none" : ""}`}
                                                onClick={() => {
                                                    modelSelection.handleModelSelect(model.id);
                                                }}
                                                onKeyDown={e => {
                                                    if (e.key === "Enter" || e.key === " ") {
                                                        modelSelection.handleModelSelect(model.id);
                                                    }
                                                }}
                                            >
                                                {model.name}
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

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
                {fixedType && (
                    <p className="text-xs text-muted-foreground mt-2">Prompt type is fixed for this context</p>
                )}
            </div>

            <div className="border-t border-input pt-6">
                <h3 className="font-medium mb-4">Prompt Settings</h3>
                <div className="space-y-4 mb-4">
                    <div className="flex items-center gap-4">
                        <Label htmlFor="temperature" className="w-28">
                            Temperature
                        </Label>
                        <div className="flex-1 flex items-center gap-2">
                            <Slider
                                id="temperature"
                                value={[formState.temperature]}
                                onValueChange={value => formState.setTemperature(value[0])}
                                min={0}
                                max={2}
                                step={0.1}
                                className="flex-1"
                            />
                            <Input
                                type="text"
                                value={formState.temperature.toFixed(1)}
                                onChange={e => {
                                    const value = parseFloat(e.target.value);
                                    if (!Number.isNaN(value) && value >= 0 && value <= 2)
                                        formState.setTemperature(value);
                                }}
                                className="w-20 text-center"
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <Label htmlFor="maxTokens" className="w-28">
                            Max Tokens
                        </Label>
                        <div className="flex-1 flex items-center gap-2">
                            <Slider
                                id="maxTokens"
                                value={[formState.maxTokens]}
                                onValueChange={value => formState.setMaxTokens(value[0])}
                                min={1}
                                max={16384}
                                className="flex-1"
                            />
                            <Input
                                type="text"
                                value={formState.maxTokens.toString()}
                                onChange={e => {
                                    if (e.target.value === "") return;

                                    const value = parseInt(e.target.value, 10);
                                    if (!Number.isNaN(value) && value >= 1 && value <= 16384)
                                        formState.setMaxTokens(value);
                                }}
                                className="w-20 text-center"
                            />
                        </div>
                    </div>
                </div>

                {/* Top-p (nucleus sampling) */}
                <div className="space-y-4 mt-4">
                    <div className="flex items-center gap-4">
                        <Label htmlFor="topP" className="w-28">
                            Top-p
                        </Label>
                        <div className="flex-1 flex items-center gap-2">
                            <Slider
                                id="topP"
                                value={[formState.topP]}
                                onValueChange={value => formState.setTopP(value[0])}
                                min={0}
                                max={1}
                                step={0.05}
                                className="flex-1"
                                disabled={formState.topP === 0}
                            />
                            <Input
                                type="text"
                                value={formState.topP === 0 ? "Disabled" : formState.topP.toFixed(2)}
                                onChange={e => {
                                    if (e.target.value === "") return;

                                    const value = parseFloat(e.target.value);
                                    if (!Number.isNaN(value) && value >= 0 && value <= 1) formState.setTopP(value);
                                }}
                                className="w-20 text-center"
                            />
                            <Button
                                type="button"
                                variant={formState.topP === 0 ? "default" : "outline"}
                                onClick={() => formState.setTopP(formState.topP === 0 ? 1.0 : 0)}
                                className="whitespace-nowrap"
                            >
                                {formState.topP === 0 ? "Enable" : "Disable"}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Top-k */}
                <div className="space-y-4 mt-4">
                    <div className="flex items-center gap-4">
                        <Label htmlFor="topK" className="w-28">
                            Top-k
                        </Label>
                        <div className="flex-1 flex items-center gap-2">
                            <Slider
                                id="topK"
                                value={[formState.topK]}
                                onValueChange={value => formState.setTopK(value[0])}
                                min={0}
                                max={100}
                                step={1}
                                className="flex-1"
                                disabled={formState.topK === 0}
                            />
                            <Input
                                type="text"
                                value={formState.topK === 0 ? "Disabled" : formState.topK.toString()}
                                onChange={e => {
                                    if (e.target.value === "") return;

                                    const value = parseInt(e.target.value, 10);
                                    if (!Number.isNaN(value) && value >= 0 && value <= 100) formState.setTopK(value);
                                }}
                                className="w-20 text-center"
                            />
                            <Button
                                type="button"
                                variant={formState.topK === 0 ? "default" : "outline"}
                                onClick={() => formState.setTopK(formState.topK === 0 ? 50 : 0)}
                                className="whitespace-nowrap"
                            >
                                {formState.topK === 0 ? "Enable" : "Disable"}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Repetition Penalty */}
                <div className="space-y-4 mt-4">
                    <div className="flex items-center gap-4">
                        <Label htmlFor="repetitionPenalty" className="w-28">
                            Repetition Penalty
                        </Label>
                        <div className="flex-1 flex items-center gap-2">
                            <Slider
                                id="repetitionPenalty"
                                value={[formState.repetitionPenalty]}
                                onValueChange={value => formState.setRepetitionPenalty(value[0])}
                                min={0}
                                max={2}
                                step={0.05}
                                className="flex-1"
                                disabled={formState.repetitionPenalty === 0}
                            />
                            <Input
                                type="text"
                                value={
                                    formState.repetitionPenalty === 0
                                        ? "Disabled"
                                        : formState.repetitionPenalty.toFixed(2)
                                }
                                onChange={e => {
                                    if (e.target.value === "") return;

                                    const value = parseFloat(e.target.value);
                                    if (!Number.isNaN(value) && value >= 0 && value <= 2)
                                        formState.setRepetitionPenalty(value);
                                }}
                                className="w-20 text-center"
                            />
                            <Button
                                type="button"
                                variant={formState.repetitionPenalty === 0 ? "default" : "outline"}
                                onClick={() =>
                                    formState.setRepetitionPenalty(formState.repetitionPenalty === 0 ? 1.0 : 0)
                                }
                                className="whitespace-nowrap"
                            >
                                {formState.repetitionPenalty === 0 ? "Enable" : "Disable"}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Min-P */}
                <div className="space-y-4 mt-4">
                    <div className="flex items-center gap-4">
                        <Label htmlFor="minP" className="w-28">
                            Min-P
                        </Label>
                        <div className="flex-1 flex items-center gap-2">
                            <Slider
                                id="minP"
                                value={[formState.minP]}
                                onValueChange={value => formState.setMinP(value[0])}
                                min={0}
                                max={1}
                                step={0.05}
                                className="flex-1"
                                disabled={formState.minP === 0}
                            />
                            <Input
                                type="text"
                                value={formState.minP === 0 ? "Disabled" : formState.minP.toFixed(2)}
                                onChange={e => {
                                    if (e.target.value === "") return;

                                    const value = parseFloat(e.target.value);
                                    if (!Number.isNaN(value) && value >= 0 && value <= 1) formState.setMinP(value);
                                }}
                                className="w-20 text-center"
                            />
                            <Button
                                type="button"
                                variant={formState.minP === 0 ? "default" : "outline"}
                                onClick={() => formState.setMinP(formState.minP === 0 ? 0.1 : 0)}
                                className="whitespace-nowrap"
                            >
                                {formState.minP === 0 ? "Enable" : "Disable"}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

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

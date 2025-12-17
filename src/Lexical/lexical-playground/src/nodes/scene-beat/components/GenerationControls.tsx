import { Loader2 } from "lucide-react";
import type { JSX } from "react";
import { Button } from "@/components/ui/button";
import { PromptSelectMenu } from "@/components/ui/prompt-select-menu";
import type { AllowedModel, Prompt } from "@/types/story";

interface LastUsedSelection {
    prompt: Prompt;
    model: AllowedModel;
}

interface GenerationControlsProps {
    isLoading: boolean;
    error: string | null;
    prompts: Prompt[];
    selectedPrompt: Prompt | undefined;
    selectedModel: AllowedModel | undefined;
    streaming: boolean;
    streamComplete: boolean;
    onPromptSelect: (prompt: Prompt, model: AllowedModel) => void;
    onPreview: () => void;
    onGenerate: () => void;
    onAccept: () => void;
    onReject: () => void;
    lastUsed?: LastUsedSelection | null;
}

/**
 * Control panel for prompt selection, preview, generation, and content acceptance.
 */
export const GenerationControls = ({
    isLoading,
    error,
    prompts,
    selectedPrompt,
    selectedModel,
    streaming,
    streamComplete,
    onPromptSelect,
    onPreview,
    onGenerate,
    onAccept,
    onReject,
    lastUsed
}: GenerationControlsProps): JSX.Element => (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border-t border-border p-2">
        <div className="flex flex-wrap gap-2 items-center">
            <PromptSelectMenu
                isLoading={isLoading}
                error={error}
                prompts={prompts}
                promptType="scene_beat"
                selectedPrompt={selectedPrompt}
                selectedModel={selectedModel}
                onSelect={onPromptSelect}
                lastUsed={lastUsed}
            />
            {selectedPrompt && (
                <Button variant="outline" size="sm" onClick={onPreview} className="text-xs sm:text-sm">
                    Preview
                </Button>
            )}
            <Button
                onClick={onGenerate}
                disabled={streaming || !selectedPrompt || !selectedModel}
                size="sm"
                className="text-xs sm:text-sm"
            >
                {streaming ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
                        <span className="hidden sm:inline">Generating...</span>
                    </>
                ) : (
                    "Generate"
                )}
            </Button>
        </div>

        {streamComplete && (
            <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={onAccept} className="text-xs sm:text-sm">
                    Accept
                </Button>
                <Button size="sm" variant="outline" onClick={onReject} className="text-xs sm:text-sm">
                    Reject
                </Button>
            </div>
        )}
    </div>
);

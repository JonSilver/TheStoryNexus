import { Loader2, Wand2 } from "lucide-react";
import type { JSX } from "react";
import { Button } from "@/components/ui/button";
import { PromptSelectMenu } from "@/components/ui/prompt-select-menu";
import type { AllowedModel, Prompt } from "@/types/story";

interface LastUsedSelection {
    prompt: Prompt;
    model: AllowedModel;
}

interface GenerateButtonsProps {
    isLoading: boolean;
    error: string | null;
    prompts: Prompt[];
    selectedPrompt: Prompt | undefined;
    selectedModel: AllowedModel | undefined;
    onSelect: (prompt: Prompt, model: AllowedModel) => void;
    lastUsed: LastUsedSelection | null | undefined;
    isGenerating: boolean;
    onPreview: () => void;
    onGenerate: () => void;
}

export const GenerateButtons = ({
    isLoading,
    error,
    prompts,
    selectedPrompt,
    selectedModel,
    onSelect,
    lastUsed,
    isGenerating,
    onPreview,
    onGenerate
}: GenerateButtonsProps): JSX.Element => {
    if (isGenerating)
        return (
            <div className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Generating...</span>
            </div>
        );

    return (
        <>
            <PromptSelectMenu
                isLoading={isLoading}
                error={error}
                prompts={prompts}
                promptType="selection_specific"
                selectedPrompt={selectedPrompt}
                selectedModel={selectedModel}
                onSelect={onSelect}
                lastUsed={lastUsed}
            />

            {selectedPrompt && (
                <Button variant="outline" size="sm" onClick={onPreview} className="flex items-center gap-1">
                    Preview
                </Button>
            )}

            <Button
                variant="outline"
                size="sm"
                onClick={onGenerate}
                disabled={isGenerating || !selectedPrompt || !selectedModel}
                className="flex items-center gap-1"
            >
                {isGenerating ? (
                    <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Generating...</span>
                    </>
                ) : (
                    <>
                        <Wand2 className="h-3 w-3" />
                        <span>Generate</span>
                    </>
                )}
            </Button>
        </>
    );
};

import { attemptPromise } from "@jfdi/attempt";
import is from "@sindresorhus/is";
import { useCallback, useState } from "react";
import { toast } from "react-toastify";
import { useGenerateWithPrompt } from "@/features/ai/hooks/useGenerateWithPrompt";
import { useStreamingGeneration } from "@/features/ai/hooks/useStreamingGeneration";
import { usePromptParser } from "@/features/prompts/hooks/usePromptParser";
import type { AllowedModel, PromptMessage, PromptParserConfig } from "@/types/story";

interface UseSceneBeatGenerationResult {
    streaming: boolean;
    streamedText: string;
    streamComplete: boolean;
    previewMessages: PromptMessage[] | undefined;
    previewLoading: boolean;
    previewError: string | null;
    generateWithConfig: (config: PromptParserConfig, model: AllowedModel | undefined) => Promise<void>;
    previewPrompt: (config: PromptParserConfig) => Promise<void>;
    stopGeneration: () => void;
    resetGeneration: () => void;
}

export const useSceneBeatGeneration = (): UseSceneBeatGenerationResult => {
    const [previewMessages, setPreviewMessages] = useState<PromptMessage[] | undefined>();
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);

    const { generateWithPrompt } = useGenerateWithPrompt();
    const { parsePrompt } = usePromptParser();
    const { isStreaming, streamedText, isComplete, processStream, abort, reset } = useStreamingGeneration();

    const generateWithConfig = useCallback(
        async (config: PromptParserConfig, model: AllowedModel | undefined): Promise<void> => {
            if (!model) {
                toast.error("Please select a model");
                return;
            }

            const [error] = await attemptPromise(async () => {
                const response = await generateWithPrompt(config, model);
                await processStream(response);
            });

            if (error) 
                toast.error("Failed to generate text");
            
        },
        [generateWithPrompt, processStream]
    );

    const previewPrompt = useCallback(
        async (config: PromptParserConfig): Promise<void> => {
            setPreviewLoading(true);
            setPreviewError(null);
            setPreviewMessages(undefined);

            const [error, parsedPrompt] = await attemptPromise(async () => parsePrompt(config));
            if (error) {
                const errorMessage = is.error(error) ? error.message : String(error);
                setPreviewError(errorMessage);
                toast.error(`Error previewing prompt: ${errorMessage}`);
                setPreviewLoading(false);
                return;
            }

            if (parsedPrompt.error) {
                setPreviewError(parsedPrompt.error);
                toast.error(`Error parsing prompt: ${parsedPrompt.error}`);
                setPreviewLoading(false);
                return;
            }

            setPreviewMessages(parsedPrompt.messages);
            setPreviewLoading(false);
        },
        [parsePrompt]
    );

    return {
        streaming: isStreaming,
        streamedText,
        streamComplete: isComplete,
        previewMessages,
        previewLoading,
        previewError,
        generateWithConfig,
        previewPrompt,
        stopGeneration: abort,
        resetGeneration: reset
    };
};

import is from "@sindresorhus/is";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "react-toastify";
import { usePromptParser } from "@/features/prompts/hooks/usePromptParser";
import type { PromptMessage, PromptParserConfig } from "@/types/story";

interface UsePromptPreviewReturn {
    showPreview: boolean;
    previewMessages: PromptMessage[] | undefined;
    previewLoading: boolean;
    previewError: string | null;
    openPreview: (config: PromptParserConfig) => Promise<void>;
    closePreview: () => void;
}

export const usePromptPreview = (): UsePromptPreviewReturn => {
    const [showPreview, setShowPreview] = useState(false);
    const { parsePrompt } = usePromptParser();

    const previewMutation = useMutation({
        mutationFn: async (config: PromptParserConfig) => {
            const parsedPrompt = await parsePrompt(config);
            if (parsedPrompt.error) 
                throw new Error(parsedPrompt.error);
            
            return parsedPrompt.messages;
        },
        onError: (error: Error) => {
            const errorMessage = is.error(error) ? error.message : String(error);
            toast.error(`Error previewing prompt: ${errorMessage}`);
        },
        onSuccess: () => {
            setShowPreview(true);
        }
    });

    const openPreview = useCallback(
        async (config: PromptParserConfig) => {
            await previewMutation.mutateAsync(config);
        },
        [previewMutation]
    );

    const closePreview = useCallback(() => {
        setShowPreview(false);
    }, []);

    return {
        showPreview,
        previewMessages: previewMutation.data,
        previewLoading: previewMutation.isPending,
        previewError: previewMutation.error?.message ?? null,
        openPreview,
        closePreview
    };
};

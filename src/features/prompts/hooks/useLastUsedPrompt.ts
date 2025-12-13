import type { AllowedModel, Prompt } from "@/types/story";
import { useCallback, useMemo } from "react";

interface LastUsedData {
    promptId: string;
    promptName: string;
    modelId: string;
    modelName: string;
}

interface LastUsedResolved {
    prompt: Prompt;
    model: AllowedModel;
}

const getStorageKey = (promptType: string) => `lastUsedPrompt:${promptType}`;

const loadLastUsed = (promptType: string): LastUsedData | null => {
    const stored = localStorage.getItem(getStorageKey(promptType));
    if (!stored) return null;
    try {
        return JSON.parse(stored) as LastUsedData;
    } catch {
        return null;
    }
};

const saveLastUsed = (promptType: string, data: LastUsedData): void => {
    localStorage.setItem(getStorageKey(promptType), JSON.stringify(data));
};

export const useLastUsedPrompt = (
    promptType: string,
    prompts: Prompt[]
): {
    lastUsed: LastUsedResolved | null;
    saveSelection: (prompt: Prompt, model: AllowedModel) => void;
} => {
    const lastUsed = useMemo((): LastUsedResolved | null => {
        const stored = loadLastUsed(promptType);
        if (!stored) return null;

        const prompt = prompts.find(p => p.id === stored.promptId);
        if (!prompt) return null;

        const model = prompt.allowedModels.find(m => m.id === stored.modelId);
        if (!model) return null;

        return { prompt, model };
    }, [promptType, prompts]);

    const saveSelection = useCallback(
        (prompt: Prompt, model: AllowedModel) => {
            saveLastUsed(promptType, {
                promptId: prompt.id,
                promptName: prompt.name,
                modelId: model.id,
                modelName: model.name
            });
        },
        [promptType]
    );

    return { lastUsed, saveSelection };
};

import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useAISettingsQuery } from "@/features/ai/hooks/useAISettingsQuery";
import { useAvailableModels } from "@/features/ai/hooks/useAvailableModels";
import type { AIModel, AllowedModel } from "@/types/story";

interface ModelsByProvider {
    [key: string]: AIModel[];
}

const MOST_USED_MODELS = [
    "Anthropic: Claude Sonnet 4",
    "DeepSeek: DeepSeek V3.1",
    "DeepSeek: DeepSeek V3 0324",
    "Mistral: Mistral Small 3.2 24B",
    "MoonshotAI: Kimi K2 0905",
    "Z.AI: GLM 4.5 Air",
    "Z.AI: GLM 4.5"
];

interface UseModelSelectionProps {
    initialModels?: AllowedModel[];
}

export const useModelSelection = ({ initialModels = [] }: UseModelSelectionProps) => {
    const { data: availableModels = [] } = useAvailableModels();
    const { data: settings } = useAISettingsQuery();
    const [selectedModels, setSelectedModels] = useState<AllowedModel[]>(initialModels);
    const [modelSearch, setModelSearch] = useState("");

    const modelGroups = useMemo(() => {
        const groups: ModelsByProvider = {
            "Most Used": [],
            Local: [],
            Gemini: [],
            xAI: [],
            Anthropic: [],
            OpenAI: [],
            DeepSeek: [],
            Mistral: [],
            NVIDIA: [],
            Free: [],
            Other: []
        };

        availableModels.forEach(model => {
            if (model.provider === "local") groups.Local.push(model);
            else if (model.provider === "gemini") groups.Gemini.push(model);
            else if (MOST_USED_MODELS.some(name => model.name === name)) groups["Most Used"].push(model);
            else if (model.name.toLowerCase().includes("(free)")) groups.Free.push(model);
            else if (model.provider === "openai") groups.OpenAI.push(model);
            else if (model.provider === "openrouter")
                if (model.name.includes("Anthropic")) groups.Anthropic.push(model);
                else if (model.name.includes("DeepSeek")) groups.DeepSeek.push(model);
                else if (model.name.includes("Mistral")) groups.Mistral.push(model);
                else if (model.name.includes("NVIDIA")) groups.NVIDIA.push(model);
                else if (model.name.includes("xAI")) groups.xAI.push(model);
                else groups.Other.push(model);

        });

        return Object.fromEntries(Object.entries(groups).filter(([_, models]) => models.length > 0));
    }, [availableModels]);

    const filteredModelGroups = useMemo(() => {
        if (!modelSearch.trim()) return modelGroups;

        const q = modelSearch.toLowerCase();
        const filtered: ModelsByProvider = {};

        Object.entries(modelGroups).forEach(([provider, models]) => {
            const matched = models.filter(
                m => m.name.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q)
            );
            if (matched.length > 0) filtered[provider] = matched;
        });

        return filtered;
    }, [modelGroups, modelSearch]);

    const handleModelSelect = (modelId: string) => {
        const selectedModel = availableModels.find(m => m.id === modelId);
        if (selectedModel && !selectedModels.some(m => m.id === modelId)) {
            const allowedModel: AllowedModel = {
                id: selectedModel.id,
                provider: selectedModel.provider,
                name: selectedModel.name
            };
            setSelectedModels([...selectedModels, allowedModel]);
        }
    };

    const removeModel = (modelId: string) => {
        setSelectedModels(selectedModels.filter(m => m.id !== modelId));
    };

    const handleUseDefaultModels = () => {
        if (!settings) {
            toast.error("AI settings not loaded");
            return;
        }

        const defaultModels: AllowedModel[] = [];
        const { defaultLocalModel, defaultOpenAIModel, defaultOpenRouterModel, defaultGeminiModel } = settings;

        if (defaultLocalModel) {
            const localModel = availableModels.find(m => m.id === defaultLocalModel);
            if (localModel)
                defaultModels.push({
                    id: localModel.id,
                    name: localModel.name,
                    provider: localModel.provider
                });

        }

        if (defaultOpenAIModel) {
            const openaiModel = availableModels.find(m => m.id === defaultOpenAIModel);
            if (openaiModel)
                defaultModels.push({
                    id: openaiModel.id,
                    name: openaiModel.name,
                    provider: openaiModel.provider
                });

        }

        if (defaultOpenRouterModel) {
            const openrouterModel = availableModels.find(m => m.id === defaultOpenRouterModel);
            if (openrouterModel)
                defaultModels.push({
                    id: openrouterModel.id,
                    name: openrouterModel.name,
                    provider: openrouterModel.provider
                });

        }

        if (defaultGeminiModel) {
            const geminiModel = availableModels.find(m => m.id === defaultGeminiModel);
            if (geminiModel)
                defaultModels.push({
                    id: geminiModel.id,
                    name: geminiModel.name,
                    provider: geminiModel.provider
                });

        }

        if (defaultModels.length === 0) {
            toast.error("No default models configured. Please set default models in AI Settings.");
            return;
        }

        setSelectedModels(defaultModels);
        toast.success(`Added ${defaultModels.length} default model(s)`);
    };

    return {
        availableModels,
        selectedModels,
        modelSearch,
        setModelSearch,
        modelGroups,
        filteredModelGroups,
        handleModelSelect,
        removeModel,
        handleUseDefaultModels
    };
};

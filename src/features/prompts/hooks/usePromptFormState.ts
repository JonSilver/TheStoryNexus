import { useState } from "react";
import type { Prompt } from "@/types/story";

type PromptType = Prompt["promptType"];

interface UsePromptFormStateProps {
    prompt?: Prompt;
    fixedType?: PromptType;
}

export const usePromptFormState = ({ prompt, fixedType }: UsePromptFormStateProps) => {
    const [name, setName] = useState(prompt?.name || "");
    const [promptType, setPromptType] = useState<PromptType>(fixedType || prompt?.promptType || "scene_beat");
    const [temperature, setTemperature] = useState(prompt?.temperature ?? 1.0);
    const [maxTokens, setMaxTokens] = useState(prompt?.maxTokens ?? 2048);
    const [topP, setTopP] = useState(prompt?.top_p ?? 1.0);
    const [topK, setTopK] = useState(prompt?.top_k ?? 50);
    const [repetitionPenalty, setRepetitionPenalty] = useState(prompt?.repetition_penalty ?? 1.0);
    const [minP, setMinP] = useState(prompt?.min_p ?? 0.0);

    return {
        name,
        setName,
        promptType,
        setPromptType,
        temperature,
        setTemperature,
        maxTokens,
        setMaxTokens,
        topP,
        setTopP,
        topK,
        setTopK,
        repetitionPenalty,
        setRepetitionPenalty,
        minP,
        setMinP
    };
};

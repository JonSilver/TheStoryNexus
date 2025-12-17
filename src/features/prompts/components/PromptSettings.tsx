import type { usePromptFormState } from "../hooks/usePromptFormState";
import { SliderWithInput } from "./SliderWithInput";

interface PromptSettingsProps {
    formState: ReturnType<typeof usePromptFormState>;
}

const SLIDER_CONFIGS = {
    temperature: { min: 0, max: 2, step: 0.1, decimals: 1 },
    maxTokens: { min: 1, max: 16384, step: 1 },
    topP: { min: 0, max: 1, step: 0.05, decimals: 2, defaultEnabled: 1.0 },
    topK: { min: 0, max: 100, step: 1, defaultEnabled: 50 },
    repetitionPenalty: { min: 0, max: 2, step: 0.05, decimals: 2, defaultEnabled: 1.0 },
    minP: { min: 0, max: 1, step: 0.05, decimals: 2, defaultEnabled: 0.1 }
} as const;

export const PromptSettings = ({ formState }: PromptSettingsProps) => (
    <div className="border-t border-input pt-6">
        <h3 className="font-medium mb-4">Prompt Settings</h3>
        <div className="space-y-4">
            <SliderWithInput
                id="temperature"
                label="Temperature"
                value={formState.temperature}
                onChange={formState.setTemperature}
                config={SLIDER_CONFIGS.temperature}
            />
            <SliderWithInput
                id="maxTokens"
                label="Max Tokens"
                value={formState.maxTokens}
                onChange={formState.setMaxTokens}
                config={SLIDER_CONFIGS.maxTokens}
            />
            <SliderWithInput
                id="topP"
                label="Top-p"
                value={formState.topP}
                onChange={formState.setTopP}
                config={SLIDER_CONFIGS.topP}
                disableable
            />
            <SliderWithInput
                id="topK"
                label="Top-k"
                value={formState.topK}
                onChange={formState.setTopK}
                config={SLIDER_CONFIGS.topK}
                disableable
            />
            <SliderWithInput
                id="repetitionPenalty"
                label="Repetition Penalty"
                value={formState.repetitionPenalty}
                onChange={formState.setRepetitionPenalty}
                config={SLIDER_CONFIGS.repetitionPenalty}
                disableable
            />
            <SliderWithInput
                id="minP"
                label="Min-P"
                value={formState.minP}
                onChange={formState.setMinP}
                config={SLIDER_CONFIGS.minP}
                disableable
            />
        </div>
    </div>
);

import { ModelSelector } from "@/components/ui/model-selector";
import { useAISettingsQuery } from "@/features/ai/hooks/useAISettingsQuery";
import type { AIProvider, ModelChoice } from "@/types/story";

export interface OverrideParams {
    temperature: number;
    maxTokens: number;
    topP: number | null;
    frequencyPenalty: number | null;
    presencePenalty: number | null;
    modelRef: string | null;
}

const NUMERIC_FIELDS: Array<{
    key: "temperature" | "topP" | "frequencyPenalty" | "presencePenalty";
    label: string;
    min: number;
    max: number;
    step: number;
    hint: string;
}> = [
    { key: "temperature", label: "Temperature", min: 0, max: 2, step: 0.1, hint: "randomness" },
    { key: "topP", label: "Top-p", min: 0, max: 1, step: 0.05, hint: "nucleus sampling" },
    { key: "frequencyPenalty", label: "Freq. penalty", min: -2, max: 2, step: 0.1, hint: "discourage repetition" },
    { key: "presencePenalty", label: "Pres. penalty", min: -2, max: 2, step: 0.1, hint: "encourage new topics" }
];

/** An override names its model as "provider::modelId". */
const fromModelRef = (ref: string | null): ModelChoice | null => {
    const [provider, ...rest] = ref?.split("::") ?? [];
    return provider && rest.length ? { provider: provider as AIProvider, modelId: rest.join("::") } : null;
};

/**
 * Per-action model + sampling parameters. Model and the optional samplers
 * default to "app default"/unset — unset values are simply not sent to the
 * provider, leaving the model server's own tuning in charge. Deeper knobs
 * (top_k, min_p, repeat_penalty, mirostat) don't travel over the
 * OpenAI-compatible API — set those in an Ollama Modelfile.
 */
export const OverrideParamFields = ({
    params,
    onChange
}: {
    params: OverrideParams;
    onChange: (next: OverrideParams) => void;
}) => {
    const { data: settings } = useAISettingsQuery();

    return (
        <div className="space-y-3">
            <div className="text-sm">
                <span className="mb-1 block text-muted-foreground">Model for this action</span>
                <ModelSelector
                    ariaLabel="Model for this action"
                    value={fromModelRef(params.modelRef)}
                    onChange={next => onChange({ ...params, modelRef: next && `${next.provider}::${next.modelId}` })}
                    noneLabel={`App default${settings?.defaultModelId ? ` (${settings.defaultModelId})` : ""}`}
                />
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
                {NUMERIC_FIELDS.map(({ key, label, min, max, step, hint }) => (
                    <label key={key} className="block">
                        <span className="mb-1 block text-muted-foreground" title={hint}>
                            {label}
                        </span>
                        <input
                            type="number"
                            min={min}
                            max={max}
                            step={step}
                            placeholder={key === "temperature" ? undefined : "model default"}
                            className="w-full rounded-md border bg-background px-2 py-1"
                            value={params[key] ?? ""}
                            onChange={e =>
                                onChange({
                                    ...params,
                                    [key]: e.target.value === "" ? null : Number(e.target.value)
                                })
                            }
                        />
                    </label>
                ))}
                <label className="block">
                    <span className="mb-1 block text-muted-foreground">Max tokens</span>
                    <input
                        type="number"
                        min={64}
                        max={65536}
                        step={256}
                        className="w-full rounded-md border bg-background px-2 py-1"
                        value={params.maxTokens}
                        onChange={e => onChange({ ...params, maxTokens: Number(e.target.value) })}
                    />
                </label>
            </div>
            <p className="text-xs text-muted-foreground">
                Blank sampler fields defer to the model server's own tuning. top_k / min_p / repeat_penalty live in your
                Ollama Modelfile — they don't travel over the OpenAI-compatible API.
            </p>
        </div>
    );
};

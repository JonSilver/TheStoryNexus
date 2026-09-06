import type { PromptMessage } from "../ai/providers.js";
import { type ActionDef, type ActionId, type ActionParams, BUILTIN_ACTIONS, type ContextKey } from "./registry.js";

/**
 * Template validation, override precedence (story → global → built-in),
 * and rendering (contracts §5). Overrides are validated at execution time
 * and fall back to the built-in when invalid.
 */

const VARIABLE_PATTERN = /\{\{\s*([a-z_]+)\s*\}\}/g;
const COMMENT_PATTERN = /\/\*[\s\S]*?\*\//g;

export const templateVariables = (messages: PromptMessage[]): string[] => [
    ...new Set(
        messages.flatMap(message =>
            [...message.content.replace(COMMENT_PATTERN, "").matchAll(VARIABLE_PATTERN)].map(m => m[1])
        )
    )
];

export const validateTemplate = (
    messages: PromptMessage[],
    contextNeeds: ContextKey[]
): { valid: true } | { valid: false; unknownVariables: string[] } => {
    const allowed = new Set<string>(contextNeeds);
    const unknown = templateVariables(messages).filter(variable => !allowed.has(variable));
    return unknown.length === 0 ? { valid: true } : { valid: false, unknownVariables: unknown };
};

export interface ActionOverrideRow {
    actionId: string;
    storyId: string | null;
    template: PromptMessage[] | null;
    temperature: number | null;
    maxTokens: number | null;
    topP: number | null;
    frequencyPenalty: number | null;
    presencePenalty: number | null;
    modelRef: string | null;
}

export interface ResolvedAction {
    def: ActionDef;
    template: PromptMessage[];
    params: ActionParams;
    modelRef?: string;
}

const isValidOverrideTemplate = (template: unknown, def: ActionDef): template is PromptMessage[] =>
    Array.isArray(template) &&
    template.length > 0 &&
    template.every(
        m =>
            m &&
            typeof m === "object" &&
            ["system", "user", "assistant"].includes((m as PromptMessage).role) &&
            typeof (m as PromptMessage).content === "string"
    ) &&
    validateTemplate(template as PromptMessage[], def.contextNeeds).valid;

export const resolveAction = (actionId: ActionId, storyId: string | null, overrides: ActionOverrideRow[]): ResolvedAction => {
    const def = BUILTIN_ACTIONS[actionId];
    const relevant = overrides.filter(o => o.actionId === actionId);
    // Story-scoped override wins over global; built-in fills any gaps
    const chain = [
        ...(storyId ? relevant.filter(o => o.storyId === storyId) : []),
        ...relevant.filter(o => o.storyId === null)
    ];

    const template = chain.map(o => o.template).find(t => isValidOverrideTemplate(t, def)) ?? def.defaultTemplate;
    // Contract §5: an INVALID stored value falls through to the next scope
    // (then the built-in) rather than being silently clamped into range
    const pick = <K extends keyof ActionOverrideRow>(key: K, valid: (value: NonNullable<ActionOverrideRow[K]>) => boolean) =>
        chain
            .map(o => o[key])
            .find(value => value !== null && value !== undefined && valid(value as NonNullable<ActionOverrideRow[K]>));

    const inRange = (min: number, max: number) => (value: number) => Number.isFinite(value) && value >= min && value <= max;
    return {
        def,
        template,
        params: {
            temperature: (pick("temperature", inRange(0, 2)) as number | undefined) ?? def.defaultParams.temperature,
            maxTokens: Math.floor(
                (pick("maxTokens", inRange(64, 65536)) as number | undefined) ?? def.defaultParams.maxTokens
            ),
            topP: (pick("topP", inRange(0, 1)) as number | undefined) ?? def.defaultParams.topP,
            frequencyPenalty:
                (pick("frequencyPenalty", inRange(-2, 2)) as number | undefined) ?? def.defaultParams.frequencyPenalty,
            presencePenalty:
                (pick("presencePenalty", inRange(-2, 2)) as number | undefined) ?? def.defaultParams.presencePenalty
        },
        modelRef:
            (pick(
                "modelRef",
                value => typeof value === "string" && /^(openai|openrouter|gemini|local)::.+$/.test(value)
            ) as string | undefined) ?? undefined
    };
};

/**
 * Renders a template against resolved context. Comments are stripped;
 * variables absent from context render as empty strings; the story voice
 * is appended to the system message for voiceApplies actions.
 */
export const renderTemplate = (
    template: PromptMessage[],
    context: Partial<Record<ContextKey, string>>,
    voice?: string
): PromptMessage[] =>
    template
        .map((message, index) => {
            const content = message.content
                .replace(COMMENT_PATTERN, "")
                .replace(VARIABLE_PATTERN, (_, variable: string) => context[variable as ContextKey] ?? "")
                .trim();
            const withVoice =
                index === 0 && message.role === "system" && voice?.trim()
                    ? `${content}\n\nStory voice and framing (follow strictly): ${voice.trim()}`
                    : content;
            return { ...message, content: withVoice };
        })
        .filter(message => message.content.length > 0);

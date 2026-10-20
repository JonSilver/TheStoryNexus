import type { AIProvider, PromptMessage } from "./story";

export type ActionId =
    | "continue"
    | "rework"
    | "expand"
    | "shorten"
    | "summarise_chapter"
    | "brainstorm"
    | "scene_beat"
    | "extract_entries"
    | "propose_updates"
    | "ask"
    | "check_continuity"
    | "merge_entries"
    | "derive_voice"
    | "transpose_brief"
    | "transpose_synopsis"
    | "transpose_entry";

export interface ActionDefinition {
    id: ActionId;
    label: string;
    voiceApplies: boolean;
    contextNeeds: string[];
    defaultTemplate: PromptMessage[];
    defaultParams: {
        temperature: number;
        maxTokens: number;
        topP?: number;
        frequencyPenalty?: number;
        presencePenalty?: number;
    };
}

export interface OverrideRow {
    id: string;
    actionId: ActionId;
    storyId: string | null;
    template: PromptMessage[] | null;
    temperature: number | null;
    maxTokens: number | null;
    topP: number | null;
    frequencyPenalty: number | null;
    presencePenalty: number | null;
    modelRef: string | null;
}

export interface OverridePayload {
    actionId: ActionId;
    storyId: string | null;
    template?: PromptMessage[] | null;
    temperature?: number | null;
    maxTokens?: number | null;
    topP?: number | null;
    frequencyPenalty?: number | null;
    presencePenalty?: number | null;
    modelRef?: string | null;
}

/** What the editor contributes to an action's context; the server assembles the rest. */
export interface ActionEditorContext {
    selection?: string;
    recentProse?: string;
    command?: string;
    povCharacter?: string;
    povType?: string;
    userMessage?: string;
    chatHistory?: string;
    guidance?: string;
}

/** The model that answered a generation, and what chose it (the server's `model` event). */
export interface AnsweredModel {
    provider: AIProvider;
    modelId: string;
    /** "story" / "global": that scope's override for the action; "default": the app default. */
    source: "request" | "story" | "global" | "default";
}

// Base types for common fields (used across all entities)
interface BaseEntity {
    id: string;
    createdAt: Date;
    isDemo?: boolean; // Flag to identify demo content
}

// Core story type
export interface Story extends BaseEntity {
    title: string;
    author: string;
    language: string;
    synopsis?: string;
    aiInstructions?: string; // per-story voice/framing, injected into prose actions only
    seriesId?: string;
}

// Series type
export interface Series extends BaseEntity {
    name: string;
    description?: string;
}

// Chapter structure
export interface Chapter extends BaseEntity {
    storyId: string;
    title: string;
    summary?: string;
    order: number;
    content: string;
    /** Server-managed: bumps on significant prose change only — summary freshness. */
    revision?: number;
    /** Server-managed: bumps on every real content change — save concurrency. */
    saveVersion?: number;
    updatedAt?: Date;
    summarySourceRevision?: number;
    /** Writer-authored summary — auto-summarise leaves it alone. */
    summaryLocked?: boolean;
    outline?: ChapterOutline;
    wordCount: number;
    povCharacter?: string;
    povType?: "First Person" | "Third Person Limited" | "Third Person Omniscient";
    notes?: ChapterNotes;
}

export interface ChapterOutline {
    content: string;
    lastUpdated: Date;
}

export interface ChapterNotes {
    content: string;
    lastUpdated: Date;
}

// AI Chat types
export interface AIChat extends BaseEntity {
    storyId: string;
    title: string;
    messages: ChatMessage[];
    /** Server-managed: moves on every messages write — concurrency between devices. */
    revision?: number;
    updatedAt?: Date;
    lastUsedPromptId?: string;
    lastUsedModelId?: string;
}

export interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
    /** Every regenerated version of an assistant reply; `content` is the one shown and sent as history. */
    versions?: string[];
    /** Versions (indexes into `versions`, or 0 when there are none) cut short by a failure — kept, and labelled. */
    interruptedVersions?: number[];
    /** Which version `content` is — content alone can't say when two versions match. */
    shownVersion?: number;
    /** The change that added each version (null for older ones) — a retried save is recognised, not doubled. */
    versionIds?: (string | null)[];
    /** The change that last set the shown version — a stale choice never overrides a newer one. */
    shownBy?: string;
    // Optional edit metadata
    originalContent?: string; // the original content before the first edit
    editedAt?: string; // ISO timestamp when last edited
    editedBy?: string; // who edited it (e.g., 'user')
    edited?: boolean; // convenience flag
}

// Prompt related types
export interface PromptMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

// AI Provider and Model types
export type AIProvider = "openai" | "openrouter" | "local" | "gemini";

export interface AIModel {
    id: string;
    name: string;
    provider: AIProvider;
    contextLength: number;
    enabled: boolean;
}

export interface AISettings extends BaseEntity {
    hasOpenaiKey?: boolean;
    hasOpenrouterKey?: boolean;
    hasGeminiKey?: boolean;
    availableModels: AIModel[];
    lastModelsFetch?: Date;
    localApiUrl?: string;
    defaultLocalModel?: string;
    defaultOpenAIModel?: string;
    defaultOpenRouterModel?: string;
    defaultGeminiModel?: string;
    defaultProvider?: AIProvider;
    defaultModelId?: string;
}

// Note types
export interface Note extends BaseEntity {
    storyId: string;
    title: string;
    content: string;
    type: "idea" | "research" | "todo" | "other";
    updatedAt: Date;
}

// Lorebook types
export type LorebookLevel = "global" | "series" | "story";

/** In the order the bible lists them. */
export const LOREBOOK_CATEGORIES = [
    "character",
    "location",
    "item",
    "event",
    "note",
    "synopsis",
    "starting scenario",
    "timeline"
] as const;
export type LorebookCategory = (typeof LOREBOOK_CATEGORIES)[number];

export interface LorebookEntry extends BaseEntity {
    level: LorebookLevel;
    scopeId?: string; // seriesId when level='series', storyId when level='story'
    name: string;
    description: string;
    category: LorebookCategory;
    // Tags are stored as an array of strings, can contain spaces and special characters
    tags: string[];
    metadata?: {
        type?: string;
        importance?: "major" | "minor" | "background";
        status?: "active" | "inactive" | "historical";
        relationships?: Array<{
            targetId: string;
            type: string;
            description?: string;
        }>;
        customFields?: Record<string, unknown>;
    };
    isDisabled?: boolean;
}

/** A story backup file, as the server writes and reads it (the demo story ships as one). */
export interface StoryExport {
    version: string;
    type: "story";
    exportDate: string;
    story: Story;
    series?: Series;
    chapters: Chapter[];
    lorebookEntries: LorebookEntry[];
    aiChats: AIChat[];
    notes?: Note[];
}

import type { LorebookEntry } from "@/types/story";

export type LorebookLevel = LorebookEntry["level"];
export type LorebookCategory = LorebookEntry["category"];

export const CATEGORIES: LorebookCategory[] = [
    "character",
    "location",
    "item",
    "event",
    "note",
    "synopsis",
    "starting scenario",
    "timeline"
];

export const IMPORTANCE_LEVELS = ["major", "minor", "background"] as const;
export const STATUS_OPTIONS = ["active", "inactive", "historical"] as const;

type ImportanceLevel = (typeof IMPORTANCE_LEVELS)[number];
type StatusOption = (typeof STATUS_OPTIONS)[number];

export interface CreateEntryForm {
    level: LorebookLevel;
    scopeId: string;
    name: string;
    category: LorebookCategory;
    importance: ImportanceLevel;
    tags: string;
    description: string;
    type: string;
    status: StatusOption;
    isDisabled: boolean;
}

export const getDefaultFormValues = (
    entry?: LorebookEntry,
    seriesId?: string,
    storyId?: string,
    defaultCategory?: LorebookCategory
): CreateEntryForm => {
    const defaultLevel: LorebookLevel = entry?.level || (seriesId ? "series" : "story");
    const defaultScopeId = entry?.scopeId || seriesId || storyId || "";

    return {
        level: defaultLevel,
        scopeId: defaultScopeId,
        name: entry?.name || "",
        category: entry?.category || defaultCategory || "character",
        importance: entry?.metadata?.importance || "minor",
        tags: entry?.tags?.join(", ") || "",
        description: entry?.description || "",
        type: entry?.metadata?.type || "",
        status: entry?.metadata?.status || "active",
        isDisabled: entry?.isDisabled || false
    };
};

export const buildSubmitData = (data: CreateEntryForm) => {
    const processedTags = data.tags
        .split(",")
        .map(tag => tag.trim())
        .filter(Boolean);

    return {
        name: data.name,
        description: data.description,
        category: data.category,
        tags: processedTags,
        isDisabled: data.isDisabled,
        metadata: {
            importance: data.importance,
            status: data.status,
            type: data.type,
            relationships: [],
            customFields: {}
        },
        level: data.level,
        scopeId: data.level === "global" ? undefined : data.scopeId
    };
};

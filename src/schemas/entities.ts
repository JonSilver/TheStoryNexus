import { z } from "zod";

// Wrapper schema for JSON string parsing
const jsonStringSchema = z.string().transform((str, ctx) => {
    try {
        return JSON.parse(str) as unknown;
    } catch (e) {
        ctx.addIssue({
            code: "custom",
            message: e instanceof Error ? e.message : "Invalid JSON"
        });
        return z.NEVER;
    }
});

// Helper for safe JSON parsing with Zod validation
export const parseJSON = <T extends z.ZodTypeAny>(schema: T, jsonString: string) => {
    const jsonResult = jsonStringSchema.safeParse(jsonString);
    if (!jsonResult.success) return jsonResult;
    return schema.safeParse(jsonResult.data);
};

// Helper for localStorage with Zod validation
export const parseLocalStorage = <T extends z.ZodTypeAny>(
    schema: T,
    key: string,
    defaultValue: z.output<T>
): z.output<T> => {
    const stored = localStorage.getItem(key);
    if (!stored) return defaultValue;

    const result = parseJSON(schema, stored);
    return result.success ? result.data : defaultValue;
};

// Base schema for common fields
const baseEntitySchema = z.object({
    id: z.string().uuid(),
    createdAt: z.coerce.date(),
    isDemo: z.boolean().optional()
});

// POV Type enum
const povTypeSchema = z.enum(["First Person", "Third Person Limited", "Third Person Omniscient"]);

// Story schema (used internally for export validation)
const storySchema = baseEntitySchema.extend({
    title: z.string().min(1, "Title is required"),
    author: z.string().min(1, "Author is required"),
    language: z.string().min(1, "Language is required"),
    synopsis: z.string().optional(),
    seriesId: z.string().uuid().optional()
});

// Series schema
const seriesSchema = baseEntitySchema.extend({
    name: z.string().min(1, "Name required"),
    description: z.string().optional()
});

// Chapter schemas
const chapterOutlineSchema = z.object({
    content: z.string(),
    lastUpdated: z.coerce.date()
});

const chapterNotesSchema = z.object({
    content: z.string(),
    lastUpdated: z.coerce.date()
});

const chapterSchema = baseEntitySchema.extend({
    storyId: z.string().uuid(),
    title: z.string().min(1, "Chapter title is required"),
    summary: z.string().optional(),
    order: z.number().int().nonnegative(),
    content: z.string(),
    outline: chapterOutlineSchema.optional(),
    wordCount: z.number().int().nonnegative(),
    povCharacter: z.string().optional(),
    povType: povTypeSchema.optional(),
    notes: chapterNotesSchema.optional()
});

// SceneBeat schema (used internally for export validation)
const sceneBeatSchema = baseEntitySchema.extend({
    storyId: z.string().uuid(),
    chapterId: z.string().uuid(),
    command: z.string(),
    povType: povTypeSchema.optional(),
    povCharacter: z.string().optional(),
    generatedContent: z.string().optional(),
    accepted: z.boolean().optional(),
    metadata: z
        .object({
            useMatchedChapter: z.boolean().optional(),
            useMatchedSceneBeat: z.boolean().optional(),
            useCustomContext: z.boolean().optional()
        })
        .catchall(z.unknown())
        .optional()
});

// Chat message schema
const chatMessageSchema = z.object({
    id: z.string().uuid(),
    role: z.enum(["user", "assistant"]),
    content: z.string(),
    timestamp: z.coerce.date(),
    originalContent: z.string().optional(),
    editedAt: z.string().optional(),
    editedBy: z.string().optional(),
    edited: z.boolean().optional()
});

// AI Chat schema (used internally for export validation)
const aiChatSchema = baseEntitySchema.extend({
    storyId: z.string().uuid(),
    title: z.string().min(1, "Chat title is required"),
    messages: z.array(chatMessageSchema),
    updatedAt: z.coerce.date().optional()
});

// Lorebook entry schema (used internally for export validation)
const lorebookLevelSchema = z.enum(["global", "series", "story"]);

const lorebookCategorySchema = z.enum([
    "character",
    "location",
    "item",
    "event",
    "note",
    "synopsis",
    "starting scenario",
    "timeline"
]);

const relationshipSchema = z.object({
    targetId: z.string(),
    type: z.string(),
    description: z.string().optional()
});

const lorebookEntrySchema = baseEntitySchema
    .extend({
        level: lorebookLevelSchema,
        scopeId: z.string().uuid().optional(),
        name: z.string().min(1, "Entry name is required"),
        description: z.string(),
        category: lorebookCategorySchema,
        tags: z.array(z.string()),
        metadata: z
            .object({
                type: z.string().optional(),
                importance: z.enum(["major", "minor", "background"]).optional(),
                status: z.enum(["active", "inactive", "historical"]).optional(),
                relationships: z.array(relationshipSchema).optional(),
                customFields: z.record(z.string(), z.unknown()).optional()
            })
            .optional(),
        isDisabled: z.boolean().optional()
    })
    .refine(
        data => {
            if (data.level === "global") return !data.scopeId;
            return !!data.scopeId;
        },
        { message: "scopeId required for series/story level, forbidden for global level" }
    );

export const lorebookExportSchema = z.object({
    version: z.string(),
    type: z.literal("lorebook"),
    entries: z.array(lorebookEntrySchema)
});

// Story export schema
export const storyExportSchema = z.object({
    version: z.string(),
    type: z.literal("story"),
    exportDate: z.string(),
    story: storySchema,
    series: seriesSchema.optional(),
    chapters: z.array(chapterSchema),
    lorebookEntries: z.array(lorebookEntrySchema),
    sceneBeats: z.array(sceneBeatSchema),
    aiChats: z.array(aiChatSchema)
});

// AI Model schema
const aiProviderSchema = z.enum(["openai", "openrouter", "local", "gemini"]);

const aiModelSchema = z.object({
    id: z.string(),
    name: z.string(),
    provider: aiProviderSchema
});

// AI Settings schema
export const aiSettingsSchema = baseEntitySchema.extend({
    openaiKey: z.string().optional(),
    openrouterKey: z.string().optional(),
    geminiKey: z.string().optional(),
    availableModels: z.array(aiModelSchema),
    lastModelsFetch: z.coerce.date().optional(),
    localApiUrl: z.string().optional(),
    defaultLocalModel: z.string().optional(),
    defaultOpenAIModel: z.string().optional(),
    defaultOpenRouterModel: z.string().optional(),
    defaultGeminiModel: z.string().optional()
});

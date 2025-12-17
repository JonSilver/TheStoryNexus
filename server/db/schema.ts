import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Series table
export const series = sqliteTable(
    "series",
    {
        id: text("id").primaryKey(),
        name: text("name").notNull(),
        description: text("description"),
        createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
        isDemo: integer("isDemo", { mode: "boolean" })
    },
    table => ({
        nameIdx: index("series_name_idx").on(table.name),
        createdAtIdx: index("series_created_at_idx").on(table.createdAt)
    })
);

// Stories table
export const stories = sqliteTable(
    "stories",
    {
        id: text("id").primaryKey(),
        title: text("title").notNull(),
        author: text("author").notNull(),
        language: text("language").notNull(),
        synopsis: text("synopsis"),
        seriesId: text("seriesId").references(() => series.id, { onDelete: "set null" }),
        createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
        isDemo: integer("isDemo", { mode: "boolean" })
    },
    table => ({
        titleIdx: index("title_idx").on(table.title),
        createdAtIdx: index("created_at_idx").on(table.createdAt),
        seriesIdIdx: index("story_series_id_idx").on(table.seriesId)
    })
);

// Chapters table
export const chapters = sqliteTable(
    "chapters",
    {
        id: text("id").primaryKey(),
        storyId: text("storyId")
            .notNull()
            .references(() => stories.id, { onDelete: "cascade" }),
        title: text("title").notNull(),
        summary: text("summary"),
        order: integer("order").notNull(),
        content: text("content").notNull(),
        outline: text("outline", { mode: "json" }), // JSON: { content: string, lastUpdated: Date }
        wordCount: integer("wordCount").notNull().default(0),
        povCharacter: text("povCharacter"),
        povType: text("povType"), // 'First Person' | 'Third Person Limited' | 'Third Person Omniscient'
        notes: text("notes", { mode: "json" }), // JSON: { content: string, lastUpdated: Date }
        createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
        isDemo: integer("isDemo", { mode: "boolean" })
    },
    table => ({
        storyIdIdx: index("chapter_story_id_idx").on(table.storyId),
        orderIdx: index("chapter_order_idx").on(table.order)
    })
);

// AI Chats table
export const aiChats = sqliteTable(
    "aiChats",
    {
        id: text("id").primaryKey(),
        storyId: text("storyId")
            .notNull()
            .references(() => stories.id, { onDelete: "cascade" }),
        title: text("title").notNull(),
        messages: text("messages", { mode: "json" }).notNull(), // JSON: ChatMessage[]
        createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
        updatedAt: integer("updatedAt", { mode: "timestamp" }),
        lastUsedPromptId: text("lastUsedPromptId"),
        lastUsedModelId: text("lastUsedModelId"),
        isDemo: integer("isDemo", { mode: "boolean" })
    },
    table => ({
        storyIdIdx: index("chat_story_id_idx").on(table.storyId)
    })
);

// Prompts table
export const prompts = sqliteTable(
    "prompts",
    {
        id: text("id").primaryKey(),
        name: text("name").notNull(),
        description: text("description"),
        promptType: text("promptType").notNull(), // 'scene_beat' | 'gen_summary' | 'selection_specific' | 'continue_writing' | 'other' | 'brainstorm'
        messages: text("messages", { mode: "json" }).notNull(), // JSON: PromptMessage[]
        allowedModels: text("allowedModels", { mode: "json" }).notNull(), // JSON: AllowedModel[]
        storyId: text("storyId").references(() => stories.id, { onDelete: "cascade" }),
        isSystem: integer("isSystem", { mode: "boolean" }),
        temperature: integer("temperature"),
        maxTokens: integer("maxTokens"),
        top_p: integer("top_p"),
        top_k: integer("top_k"),
        repetition_penalty: integer("repetition_penalty"),
        min_p: integer("min_p"),
        createdAt: integer("createdAt", { mode: "timestamp" }).notNull()
    },
    table => ({
        nameIdx: index("prompt_name_idx").on(table.name),
        promptTypeIdx: index("prompt_type_idx").on(table.promptType),
        storyIdIdx: index("prompt_story_id_idx").on(table.storyId)
    })
);

// AI Settings table
export const aiSettings = sqliteTable("aiSettings", {
    id: text("id").primaryKey(),
    openaiKey: text("openaiKey"),
    openrouterKey: text("openrouterKey"),
    geminiKey: text("geminiKey"),
    availableModels: text("availableModels", { mode: "json" }).notNull(), // JSON: AIModel[]
    lastModelsFetch: integer("lastModelsFetch", { mode: "timestamp" }),
    localApiUrl: text("localApiUrl"),
    defaultLocalModel: text("defaultLocalModel"),
    defaultOpenAIModel: text("defaultOpenAIModel"),
    defaultOpenRouterModel: text("defaultOpenRouterModel"),
    defaultGeminiModel: text("defaultGeminiModel"),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull()
});

// Lorebook Entries table
export const lorebookEntries = sqliteTable(
    "lorebookEntries",
    {
        id: text("id").primaryKey(),
        level: text("level").notNull().default("story"),
        scopeId: text("scopeId"),
        name: text("name").notNull(),
        description: text("description").notNull(),
        category: text("category").notNull(), // 'character' | 'location' | 'item' | 'event' | 'note' | 'synopsis' | 'starting scenario' | 'timeline'
        tags: text("tags", { mode: "json" }).notNull(), // JSON: string[]
        metadata: text("metadata", { mode: "json" }), // JSON: metadata object
        isDisabled: integer("isDisabled", { mode: "boolean" }),
        createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
        isDemo: integer("isDemo", { mode: "boolean" })
    },
    table => ({
        levelIdx: index("lorebook_level_idx").on(table.level),
        scopeIdIdx: index("lorebook_scope_id_idx").on(table.scopeId),
        levelScopeIdx: index("lorebook_level_scope_idx").on(table.level, table.scopeId),
        categoryIdx: index("lorebook_category_idx").on(table.category),
        nameIdx: index("lorebook_name_idx").on(table.name)
    })
);

// Scene Beats table
export const sceneBeats = sqliteTable(
    "sceneBeats",
    {
        id: text("id").primaryKey(),
        storyId: text("storyId")
            .notNull()
            .references(() => stories.id, { onDelete: "cascade" }),
        chapterId: text("chapterId")
            .notNull()
            .references(() => chapters.id, { onDelete: "cascade" }),
        command: text("command").notNull(),
        povType: text("povType"), // 'First Person' | 'Third Person Limited' | 'Third Person Omniscient'
        povCharacter: text("povCharacter"),
        generatedContent: text("generatedContent"),
        accepted: integer("accepted", { mode: "boolean" }),
        metadata: text("metadata", { mode: "json" }), // JSON: metadata object
        createdAt: integer("createdAt", { mode: "timestamp" }).notNull()
    },
    table => ({
        storyIdIdx: index("scenebeat_story_id_idx").on(table.storyId),
        chapterIdIdx: index("scenebeat_chapter_id_idx").on(table.chapterId)
    })
);

// Notes table
export const notes = sqliteTable(
    "notes",
    {
        id: text("id").primaryKey(),
        storyId: text("storyId")
            .notNull()
            .references(() => stories.id, { onDelete: "cascade" }),
        title: text("title").notNull(),
        content: text("content").notNull(),
        type: text("type").notNull(), // 'idea' | 'research' | 'todo' | 'other'
        createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
        updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
        isDemo: integer("isDemo", { mode: "boolean" })
    },
    table => ({
        storyIdIdx: index("note_story_id_idx").on(table.storyId),
        typeIdx: index("note_type_idx").on(table.type)
    })
);

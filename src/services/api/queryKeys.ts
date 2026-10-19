/**
 * Every server-state cache key, in one place: invalidation across domains
 * (a story joining a series changes its inherited bible) names the same keys
 * the queries were stored under. Each domain's keys start with its `all`, so
 * invalidating `all` reaches every query of that domain.
 */
export const storiesKeys = {
    all: ["stories"] as const,
    detail: (id: string) => ["stories", id] as const
};

export const chaptersKeys = {
    all: ["chapters"] as const,
    byStory: (storyId: string) => ["chapters", "story", storyId] as const,
    detail: (id: string) => ["chapters", id] as const
};

export const lorebookKeys = {
    all: ["lorebook"] as const,
    /** Global + series + story entries: what a story's writer and its AI context see. */
    hierarchical: (storyId: string) => ["lorebook", "hierarchical", storyId] as const
};

export const seriesKeys = {
    all: ["series"] as const,
    list: ["series", "list"] as const,
    detail: (id: string) => ["series", "detail", id] as const
};

export const notesKeys = {
    all: ["notes"] as const,
    byStory: (storyId: string) => ["notes", "story", storyId] as const
};

export const brainstormKeys = {
    all: ["brainstorm"] as const,
    byStory: (storyId: string) => ["brainstorm", "story", storyId] as const,
    detail: (id: string) => ["brainstorm", id] as const
};

export const aiSettingsKeys = { settings: ["ai", "settings"] as const };

export const actionKeys = {
    registry: ["actions", "registry"] as const,
    overrides: ["actions", "overrides"] as const,
    overridesFor: (storyId: string | null) => ["actions", "overrides", storyId ?? "global"] as const
};

export const demoKeys = { exists: ["demo-exists"] as const };

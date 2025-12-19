import type {
    AIChat,
    AISettings,
    Chapter,
    DatabaseExport,
    GlobalLorebookExport,
    LorebookEntry,
    Note,
    Prompt,
    SceneBeat,
    Series,
    SeriesExport,
    Story,
    StoryExport
} from "@/types/story";
import { fetchJSON, uploadFile } from "./apiFactory";

// Stories API
export const storiesApi = {
    getAll: () => fetchJSON<Story[]>("/stories"),
    getById: (id: string) => fetchJSON<Story>(`/stories/${id}`),
    create: (data: Omit<Story, "createdAt">) =>
        fetchJSON<Story>("/stories", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Story>) =>
        fetchJSON<Story>(`/stories/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) => fetchJSON<{ success: boolean }>(`/stories/${id}`, { method: "DELETE" }),
    exportStory: (id: string) => fetchJSON<StoryExport>(`/stories/${id}/export`),
    importStory: (file: File) => uploadFile<Story>("/stories/import", file)
};

// Series API
export const seriesApi = {
    getAll: () => fetchJSON<Series[]>("/series"),
    getById: (id: string) => fetchJSON<Series>(`/series/${id}`),
    getStories: (seriesId: string) => fetchJSON<Story[]>(`/series/${seriesId}/stories`),
    getLorebook: (seriesId: string) => fetchJSON<LorebookEntry[]>(`/series/${seriesId}/lorebook`),
    create: (data: Omit<Series, "id" | "createdAt">) =>
        fetchJSON<Series>("/series", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Omit<Series, "id" | "createdAt">>) =>
        fetchJSON<Series>(`/series/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) => fetchJSON<{ success: boolean }>(`/series/${id}`, { method: "DELETE" }),
    exportSeries: (id: string) => fetchJSON<SeriesExport>(`/series/${id}/export`),
    importSeries: (file: File) => uploadFile<Series>("/series/import", file)
};

// Chapters API
export const chaptersApi = {
    getByStory: (storyId: string) => fetchJSON<Chapter[]>(`/chapters/story/${storyId}`),
    getById: (id: string) => fetchJSON<Chapter>(`/chapters/${id}`),
    create: (data: Omit<Chapter, "createdAt">) =>
        fetchJSON<Chapter>("/chapters", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Chapter>) =>
        fetchJSON<Chapter>(`/chapters/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) => fetchJSON<{ success: boolean }>(`/chapters/${id}`, { method: "DELETE" })
};

// Lorebook API
export const lorebookApi = {
    getByStory: (storyId: string) => fetchJSON<LorebookEntry[]>(`/lorebook/story/${storyId}`),
    getByCategory: (storyId: string, category: string) =>
        fetchJSON<LorebookEntry[]>(`/lorebook/story/${storyId}/category/${category}`),
    getByTag: (storyId: string, tag: string) => fetchJSON<LorebookEntry[]>(`/lorebook/story/${storyId}/tag/${tag}`),
    getById: (id: string) => fetchJSON<LorebookEntry>(`/lorebook/${id}`),
    create: (data: Omit<LorebookEntry, "createdAt">) =>
        fetchJSON<LorebookEntry>("/lorebook", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<LorebookEntry>) =>
        fetchJSON<LorebookEntry>(`/lorebook/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) => fetchJSON<{ success: boolean }>(`/lorebook/${id}`, { method: "DELETE" }),
    getGlobal: () => fetchJSON<LorebookEntry[]>("/lorebook/global"),
    getBySeries: (seriesId: string) => fetchJSON<LorebookEntry[]>(`/lorebook/series/${seriesId}`),
    getHierarchical: (storyId: string) => fetchJSON<LorebookEntry[]>(`/lorebook/story/${storyId}/hierarchical`),
    exportGlobal: () => fetchJSON<GlobalLorebookExport>("/lorebook/global/export"),
    importGlobal: (file: File) => uploadFile<{ success: boolean }>("/lorebook/global/import", file)
};

// Prompts API
export const promptsApi = {
    getAll: (params?: { storyId?: string; promptType?: string; includeSystem?: boolean }) => {
        const query = new URLSearchParams();
        if (params?.storyId) query.set("storyId", params.storyId);
        if (params?.promptType) query.set("promptType", params.promptType);
        if (params?.includeSystem !== undefined) query.set("includeSystem", String(params.includeSystem));
        return fetchJSON<Prompt[]>(`/prompts?${query}`);
    },
    getById: (id: string) => fetchJSON<Prompt>(`/prompts/${id}`),
    create: (data: Omit<Prompt, "id" | "createdAt">) =>
        fetchJSON<Prompt>("/prompts", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Prompt>) =>
        fetchJSON<Prompt>(`/prompts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) => fetchJSON<{ success: boolean }>(`/prompts/${id}`, { method: "DELETE" })
};

// AI Settings API
export const aiApi = {
    getSettings: () => fetchJSON<AISettings>("/ai/settings"),
    updateSettings: (id: string, data: Partial<AISettings>) =>
        fetchJSON<AISettings>(`/ai/settings/${id}`, { method: "PUT", body: JSON.stringify(data) })
};

// Brainstorm (AI Chats) API
export const brainstormApi = {
    getByStory: (storyId: string) => fetchJSON<AIChat[]>(`/brainstorm/story/${storyId}`),
    getById: (id: string) => fetchJSON<AIChat>(`/brainstorm/${id}`),
    create: (data: Omit<AIChat, "createdAt">) =>
        fetchJSON<AIChat>("/brainstorm", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<AIChat>) =>
        fetchJSON<AIChat>(`/brainstorm/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) => fetchJSON<{ success: boolean }>(`/brainstorm/${id}`, { method: "DELETE" })
};

// Scene Beats API
export const scenebeatsApi = {
    getByChapter: (chapterId: string) => fetchJSON<SceneBeat[]>(`/scenebeats/chapter/${chapterId}`),
    getById: (id: string) => fetchJSON<SceneBeat>(`/scenebeats/${id}`),
    create: (data: Omit<SceneBeat, "createdAt">) =>
        fetchJSON<SceneBeat>("/scenebeats", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<SceneBeat>) =>
        fetchJSON<SceneBeat>(`/scenebeats/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) => fetchJSON<{ success: boolean }>(`/scenebeats/${id}`, { method: "DELETE" })
};

// Notes API
export const notesApi = {
    getByStory: (storyId: string) => fetchJSON<Note[]>(`/notes/story/${storyId}`),
    getById: (id: string) => fetchJSON<Note>(`/notes/${id}`),
    create: (data: Omit<Note, "id" | "createdAt" | "updatedAt">) =>
        fetchJSON<Note>("/notes", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Note>) =>
        fetchJSON<Note>(`/notes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) => fetchJSON<{ success: boolean }>(`/notes/${id}`, { method: "DELETE" })
};

// Admin/Migration API
export const adminApi = {
    exportDatabase: () => fetchJSON<DatabaseExport>("/admin/export"),
    importDatabase: (file: File) => uploadFile<{ success: boolean }>("/admin/import", file),
    checkDemoExists: () => fetchJSON<{ exists: boolean }>("/admin/demo/exists"),
    importDemoData: () => fetchJSON<{ success: boolean; message: string }>("/admin/demo/import", { method: "POST" }),
    deleteDemoData: () =>
        fetchJSON<{ success: boolean; deleted: { series: number; stories: number; lorebookEntries: number } }>(
            "/admin/demo",
            { method: "DELETE" }
        )
};

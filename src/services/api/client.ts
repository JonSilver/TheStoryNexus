import type { ActionDefinition, ActionId, OverridePayload, OverrideRow } from "@/types/actions";
import type {
    AIChat,
    AISettings,
    Chapter,
    DatabaseExport,
    GlobalLorebookExport,
    LorebookEntry,
    Note,
    PromptMessage,
    Series,
    SeriesExport,
    Story,
    StoryExport
} from "@/types/story";
import type { ActionEditorContext } from "@/v2/ai/useActionGeneration";
import { fetchJSON, request, uploadFile } from "./request";

export interface StoryImportResult {
    success: boolean;
    storyId: string;
    title: string;
    imported: Record<string, number>;
    /** Image files from the backup that could not be restored. */
    assetsFailed: string[];
}

// Stories API
export const storiesApi = {
    getAll: () => fetchJSON<Story[]>("/stories"),
    getById: (id: string) => fetchJSON<Story>(`/stories/${id}`),
    create: (data: Omit<Story, "createdAt">) => fetchJSON<Story>("/stories", { method: "POST", json: data }),
    update: (id: string, data: Partial<Story>) => fetchJSON<Story>(`/stories/${id}`, { method: "PUT", json: data }),
    delete: (id: string) => fetchJSON<{ success: boolean }>(`/stories/${id}`, { method: "DELETE" }),
    exportStory: (id: string) => fetchJSON<StoryExport>(`/stories/${id}/export`),
    importStory: (file: File) => uploadFile<StoryImportResult>("/stories/import", file)
};

// Series API
export const seriesApi = {
    getAll: () => fetchJSON<Series[]>("/series"),
    getById: (id: string) => fetchJSON<Series>(`/series/${id}`),
    getStories: (seriesId: string) => fetchJSON<Story[]>(`/series/${seriesId}/stories`),
    getLorebook: (seriesId: string) => fetchJSON<LorebookEntry[]>(`/series/${seriesId}/lorebook`),
    create: (data: Omit<Series, "id" | "createdAt">) => fetchJSON<Series>("/series", { method: "POST", json: data }),
    update: (id: string, data: Partial<Omit<Series, "id" | "createdAt">>) =>
        fetchJSON<Series>(`/series/${id}`, { method: "PUT", json: data }),
    delete: (id: string) => fetchJSON<{ success: boolean }>(`/series/${id}`, { method: "DELETE" }),
    exportSeries: (id: string) => fetchJSON<SeriesExport>(`/series/${id}/export`),
    importSeries: (file: File) => uploadFile<Series>("/series/import", file)
};

// Chapters API
export const chaptersApi = {
    getByStory: (storyId: string) => fetchJSON<Chapter[]>(`/chapters/story/${storyId}`),
    getById: (id: string) => fetchJSON<Chapter>(`/chapters/${id}`),
    create: (data: Omit<Chapter, "createdAt">) => fetchJSON<Chapter>("/chapters", { method: "POST", json: data }),
    update: (id: string, data: Partial<Chapter>) =>
        fetchJSON<Chapter>(`/chapters/${id}`, { method: "PUT", json: data }),
    delete: (id: string) => fetchJSON<{ success: boolean }>(`/chapters/${id}`, { method: "DELETE" }),
    /**
     * The editor's content save: a value, not a throw — the saver needs 409
     * (conflict, with the current chapter) apart from any other failure.
     */
    saveContent: (
        id: string,
        content: { content: string; wordCount: number },
        expectedSaveVersion: number,
        keepalive = false
    ) =>
        request<Chapter>(`/chapters/${id}`, {
            method: "PUT",
            json: { ...content, expectedSaveVersion },
            keepalive
        }),
    /** Asks the server whether a background summary is due; it spends nothing when it isn't. */
    claimBackgroundSummary: (id: string) =>
        request<BackgroundClaim>(`/chapters/${id}/background-summary`, { method: "POST" }),
    /** A background summary lands only over the summary it set out to replace (409 otherwise). */
    saveBackgroundSummary: (
        id: string,
        summary: string,
        sourceRevision: number,
        expectedSourceRevision: number | null
    ) =>
        request<Chapter>(`/chapters/${id}`, {
            method: "PUT",
            json: { summary, summarySourceRevision: sourceRevision, backgroundSummary: { expectedSourceRevision } }
        })
};

export type BackgroundClaim =
    | { due: true; storyId: string; revision: number; summarySourceRevision: number | null }
    | { due: false; reason: string };

// Lorebook API
export const lorebookApi = {
    getByStory: (storyId: string) => fetchJSON<LorebookEntry[]>(`/lorebook/story/${storyId}`),
    getByCategory: (storyId: string, category: string) =>
        fetchJSON<LorebookEntry[]>(`/lorebook/story/${storyId}/category/${category}`),
    getByTag: (storyId: string, tag: string) => fetchJSON<LorebookEntry[]>(`/lorebook/story/${storyId}/tag/${tag}`),
    getById: (id: string) => fetchJSON<LorebookEntry>(`/lorebook/${id}`),
    create: (data: Omit<LorebookEntry, "createdAt">) =>
        fetchJSON<LorebookEntry>("/lorebook", { method: "POST", json: data }),
    update: (id: string, data: Partial<LorebookEntry>) =>
        fetchJSON<LorebookEntry>(`/lorebook/${id}`, { method: "PUT", json: data }),
    delete: (id: string) => fetchJSON<{ success: boolean }>(`/lorebook/${id}`, { method: "DELETE" }),
    getGlobal: () => fetchJSON<LorebookEntry[]>("/lorebook/global"),
    getBySeries: (seriesId: string) => fetchJSON<LorebookEntry[]>(`/lorebook/series/${seriesId}`),
    getHierarchical: (storyId: string) => fetchJSON<LorebookEntry[]>(`/lorebook/story/${storyId}/hierarchical`),
    exportGlobal: () => fetchJSON<GlobalLorebookExport>("/lorebook/global/export"),
    importGlobal: (file: File) => uploadFile<{ success: boolean }>("/lorebook/global/import", file)
};

// AI Settings API
export const aiApi = {
    getSettings: () => fetchJSON<AISettings>("/ai/settings"),
    updateSettings: (id: string, data: Partial<AISettings>) =>
        fetchJSON<AISettings>(`/ai/settings/${id}`, { method: "PUT", json: data }),
    setKey: (provider: string, key: string) =>
        fetchJSON<AISettings>(`/ai/keys/${provider}`, { method: "PUT", json: { key } }),
    setLocalUrl: (url: string) => fetchJSON<AISettings>("/ai/local-url", { method: "PUT", json: { url } }),
    refreshModels: (provider: string) => fetchJSON<AISettings>(`/ai/models/refresh/${provider}`, { method: "POST" })
};

// Brainstorm (AI Chats) API
export const brainstormApi = {
    getByStory: (storyId: string) => fetchJSON<AIChat[]>(`/brainstorm/story/${storyId}`),
    getById: (id: string) => fetchJSON<AIChat>(`/brainstorm/${id}`),
    create: (data: Omit<AIChat, "createdAt">) => fetchJSON<AIChat>("/brainstorm", { method: "POST", json: data }),
    update: (id: string, data: Partial<AIChat>) =>
        fetchJSON<AIChat>(`/brainstorm/${id}`, { method: "PUT", json: data }),
    delete: (id: string) => fetchJSON<{ success: boolean }>(`/brainstorm/${id}`, { method: "DELETE" }),
    /** Guarded by the chat's revision: 409 carries the current chat, 404 means it's gone. */
    writeMessages: (chat: AIChat, messages: AIChat["messages"]) =>
        request<AIChat>(`/brainstorm/${chat.id}`, {
            method: "PUT",
            json: { messages, expectedRevision: chat.revision ?? 0 }
        })
};

// Notes API
export const notesApi = {
    getByStory: (storyId: string) => fetchJSON<Note[]>(`/notes/story/${storyId}`),
    getById: (id: string) => fetchJSON<Note>(`/notes/${id}`),
    create: (data: Omit<Note, "id" | "createdAt" | "updatedAt">) =>
        fetchJSON<Note>("/notes", { method: "POST", json: data }),
    update: (id: string, data: Partial<Note>) => fetchJSON<Note>(`/notes/${id}`, { method: "PUT", json: data }),
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

// AI actions: the registry and per-action overrides
const overridesPath = (storyId: string | null) =>
    `/actions/overrides${storyId ? `?storyId=${encodeURIComponent(storyId)}` : ""}`;
export const actionsApi = {
    registry: () => fetchJSON<ActionDefinition[]>("/actions/registry"),
    overrides: (storyId: string | null) => fetchJSON<OverrideRow[]>(overridesPath(storyId)),
    saveOverride: (payload: OverridePayload) =>
        fetchJSON<OverrideRow>("/actions/overrides", { method: "PUT", json: payload }),
    resetOverride: (actionId: ActionId, storyId: string | null) =>
        fetchJSON<void>(`/actions/overrides/${actionId}${storyId ? `?storyId=${encodeURIComponent(storyId)}` : ""}`, {
            method: "DELETE"
        })
};

// Generation without generating: exactly what an action would send
export interface PromptPreview {
    model: { provider: string; modelId: string } | null;
    params: { temperature: number; maxTokens: number };
    promptTokens: number;
    messages: PromptMessage[];
}
export const generateApi = {
    preview: (body: { actionId: ActionId; storyId: string; chapterId?: string; editorContext: ActionEditorContext }) =>
        fetchJSON<PromptPreview>("/generate/preview", { method: "POST", json: body })
};

// Manuscript import
export interface AnalysedChapter {
    title: string;
    wordCount: number;
    preview: string;
}
export interface ManuscriptAnalysis {
    token: string;
    title: string;
    chapters: AnalysedChapter[];
}
export const ingestApi = {
    analyseFiles: (files: File[]) => {
        const form = new FormData();
        files.forEach(file => form.append("files", file));
        return request<ManuscriptAnalysis>("/ingest/analyse", { form });
    },
    analyseText: (text: string) => request<ManuscriptAnalysis>("/ingest/analyse-text", { json: { text } }),
    commit: (body: { token: string; title: string; chapters: Array<{ index: number; title: string }> }) =>
        request<{ storyId: string; chapterCount: number }>("/ingest/commit", { json: body })
};

// Story images
export const assetsApi = {
    upload: (storyId: string, file: File) => {
        const form = new FormData();
        form.append("file", file);
        return request<{ url: string }>(`/assets/${storyId}`, { form });
    }
};

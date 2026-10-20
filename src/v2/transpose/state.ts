/**
 * What a transposition (#77) remembers between visits: every draft the model
 * produced for each layer (nothing generated is lost) and what the writer
 * decided. Shared by client and server; stored as JSON, so it's read back
 * through readState — a backup file is untrusted, and old rows may lack
 * newer fields.
 */

export const STAGES = ["brief", "synopsis", "bible", "chapters", "done"] as const;
export type Stage = (typeof STAGES)[number];

export interface EntryValue {
    name: string;
    category: string;
    description: string;
    tags: string[];
}

export interface EntryState {
    /** The entry as it was before transposing. */
    original: EntryValue;
    attempts: EntryValue[];
    status: "pending" | "accepted" | "kept";
}

export interface TranspositionState {
    briefAttempts: string[];
    synopsis: { original: string; attempts: string[] };
    entries: Record<string, EntryState>;
    /** The bible's order on screen and in prompts. */
    entryOrder: string[];
}

export interface Transposition {
    id: string;
    storyId: string;
    sourceStoryId: string | null;
    target: string;
    brief: string | null;
    stage: Stage;
    state: TranspositionState;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);
const str = (value: unknown): string => (typeof value === "string" ? value : "");
const strings = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const readEntryValue = (value: unknown): EntryValue => {
    const entry = isRecord(value) ? value : {};
    return {
        name: str(entry.name),
        category: str(entry.category) || "note",
        description: str(entry.description),
        tags: strings(entry.tags)
    };
};

const ENTRY_STATUSES = new Set<EntryState["status"]>(["pending", "accepted", "kept"]);

const readEntry = (value: unknown): EntryState => {
    const entry = isRecord(value) ? value : {};
    const status = str(entry.status) as EntryState["status"];
    return {
        original: readEntryValue(entry.original),
        attempts: Array.isArray(entry.attempts) ? entry.attempts.map(readEntryValue) : [],
        status: ENTRY_STATUSES.has(status) ? status : "pending"
    };
};

export const readState = (value: unknown): TranspositionState => {
    const state = isRecord(value) ? value : {};
    const synopsis = isRecord(state.synopsis) ? state.synopsis : {};
    const entries = Object.fromEntries(
        Object.entries(isRecord(state.entries) ? state.entries : {}).map(([id, entry]) => [id, readEntry(entry)])
    );
    return {
        briefAttempts: strings(state.briefAttempts),
        synopsis: { original: str(synopsis.original), attempts: strings(synopsis.attempts) },
        entries,
        // Only entries that exist, each once; any missing from the order go last
        entryOrder: [...new Set([...strings(state.entryOrder), ...Object.keys(entries)])].filter(id => id in entries)
    };
};

export const readStage = (value: unknown): Stage => (STAGES.includes(value as Stage) ? (value as Stage) : "brief");

export const pendingEntries = (state: TranspositionState): string[] =>
    state.entryOrder.filter(id => state.entries[id]?.status === "pending");

/** A fresh state for a copy: its synopsis and bible as they are now. */
export const initialState = (synopsis: string, entries: Array<{ id: string } & EntryValue>): TranspositionState => ({
    briefAttempts: [],
    synopsis: { original: synopsis, attempts: [] },
    entries: Object.fromEntries(
        entries.map(({ id, ...original }) => [id, { original, attempts: [], status: "pending" as const }])
    ),
    entryOrder: entries.map(entry => entry.id)
});

/** The state with its entry and chapter ids moved to a restored copy's (backups, duplicates). */
export const remapState = (state: TranspositionState, entryIds: Map<string, string>): TranspositionState => {
    const entries = Object.fromEntries(
        Object.entries(state.entries).flatMap(([id, entry]) => {
            const next = entryIds.get(id);
            return next ? [[next, entry]] : [];
        })
    );
    return {
        ...state,
        entries,
        entryOrder: state.entryOrder.map(id => entryIds.get(id)).filter((id): id is string => Boolean(id))
    };
};

/** One change to a transposition, applied by the server to what it has stored. */
export type TranspositionOp =
    | { op: "addBriefAttempt"; text: string }
    | { op: "acceptBrief"; brief: string }
    | { op: "addSynopsisAttempt"; text: string }
    | { op: "acceptSynopsis"; synopsis: string | null }
    | { op: "addEntryAttempt"; entryId: string; value: Omit<EntryValue, "category"> }
    | { op: "acceptEntry"; entryId: string; value: Omit<EntryValue, "category"> }
    | { op: "keepEntry"; entryId: string }
    | { op: "finishBible" };

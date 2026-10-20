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

/** A draft of an outline or a piece; one cut short (a failure, a Stop) is incomplete until the writer edits it. */
export interface ChapterText {
    text: string;
    incomplete?: true;
}

export interface ChapterDraft {
    outlineAttempts: ChapterText[];
    /** The chapter's saveVersion the outline was drafted from. */
    outlineSourceSaveVersion: number | null;
    /** The chapter's saveVersion its pieces were drafted from: the drafts fit that text and no other. */
    sourceSaveVersion: number | null;
    /** Every draft of each prose piece, in order (pieces.ts). */
    pieces: ChapterText[][];
    /** Piece drafts from before the chapter changed: they no longer fit, but they're the writer's. */
    earlier: ChapterText[];
    status: "pending" | "accepted";
}

export interface TranspositionState {
    briefAttempts: string[];
    synopsis: { original: string; attempts: string[] };
    entries: Record<string, EntryState>;
    /** The bible's order on screen and in prompts. */
    entryOrder: string[];
    chapters: Record<string, ChapterDraft>;
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

export const emptyChapter = (): ChapterDraft => ({
    outlineAttempts: [],
    outlineSourceSaveVersion: null,
    sourceSaveVersion: null,
    pieces: [],
    earlier: [],
    status: "pending"
});

const readText = (value: unknown): ChapterText | null => {
    if (typeof value === "string") return { text: value };
    if (!isRecord(value) || typeof value.text !== "string") return null;
    return value.incomplete === true ? { text: value.text, incomplete: true } : { text: value.text };
};
const texts = (value: unknown): ChapterText[] =>
    Array.isArray(value) ? value.map(readText).filter((text): text is ChapterText => text !== null) : [];
const version = (value: unknown): number | null => (Number.isSafeInteger(value) ? (value as number) : null);

const readChapter = (value: unknown): ChapterDraft => {
    const chapter = isRecord(value) ? value : {};
    return {
        outlineAttempts: texts(chapter.outlineAttempts),
        outlineSourceSaveVersion: version(chapter.outlineSourceSaveVersion),
        sourceSaveVersion: version(chapter.sourceSaveVersion),
        pieces: Array.isArray(chapter.pieces) ? chapter.pieces.map(texts) : [],
        earlier: texts(chapter.earlier),
        status: chapter.status === "accepted" ? "accepted" : "pending"
    };
};

/** The newest draft that's whole, if any. */
export const lastComplete = (drafts: ChapterText[]): ChapterText | undefined =>
    [...drafts].reverse().find(draft => !draft.incomplete);

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
        entryOrder: [...new Set([...strings(state.entryOrder), ...Object.keys(entries)])].filter(id => id in entries),
        chapters: Object.fromEntries(
            Object.entries(isRecord(state.chapters) ? state.chapters : {}).map(([id, chapter]) => [
                id,
                readChapter(chapter)
            ])
        )
    };
};

export const readStage = (value: unknown): Stage => (STAGES.includes(value as Stage) ? (value as Stage) : "brief");

/**
 * Until the bible is settled the transposition follows the copy's live bible:
 * an entry deleted there leaves it, one added there joins as undecided, and
 * an undecided entry's "original" is what it is now (edits made in the Bible
 * screen count). Decided entries keep their record of how they were.
 */
export const syncEntries = (
    state: TranspositionState,
    live: Array<{ id: string } & EntryValue>
): TranspositionState => {
    const liveIds = new Set(live.map(entry => entry.id));
    return {
        ...state,
        entries: Object.fromEntries(
            live.map(({ id, ...value }) => {
                const known = state.entries[id];
                if (!known) return [id, { original: value, attempts: [], status: "pending" as const }];
                return [id, known.status === "pending" ? { ...known, original: value } : known];
            })
        ),
        entryOrder: [
            ...state.entryOrder.filter(id => liveIds.has(id)),
            ...live.map(entry => entry.id).filter(id => !(id in state.entries))
        ]
    };
};

export const pendingEntries = (state: TranspositionState): string[] =>
    state.entryOrder.filter(id => state.entries[id]?.status === "pending");

/** A fresh state for a copy: its synopsis and bible as they are now. */
export const initialState = (synopsis: string, entries: Array<{ id: string } & EntryValue>): TranspositionState => ({
    briefAttempts: [],
    synopsis: { original: synopsis, attempts: [] },
    entries: Object.fromEntries(
        entries.map(({ id, ...original }) => [id, { original, attempts: [], status: "pending" as const }])
    ),
    entryOrder: entries.map(entry => entry.id),
    chapters: {}
});

const rekeyed = <T>(record: Record<string, T>, ids: Map<string, string>): Record<string, T> =>
    Object.fromEntries(
        Object.entries(record).flatMap(([id, value]) => {
            const next = ids.get(id);
            return next ? [[next, value]] : [];
        })
    );

/** The state with its entry and chapter ids moved to a restored copy's (backups, duplicates). */
export const remapState = (
    state: TranspositionState,
    entryIds: Map<string, string>,
    chapterIds: Map<string, string>
): TranspositionState => ({
    ...state,
    entries: rekeyed(state.entries, entryIds),
    entryOrder: state.entryOrder.map(id => entryIds.get(id)).filter((id): id is string => Boolean(id)),
    // Restored chapters keep their saveVersion, so drafts made from them still fit
    chapters: rekeyed(state.chapters, chapterIds)
});

/** One change to a transposition, applied by the server to what it has stored. */
export type TranspositionOp =
    | { op: "addBriefAttempt"; text: string }
    | { op: "acceptBrief"; brief: string }
    | { op: "addSynopsisAttempt"; text: string }
    | { op: "acceptSynopsis"; synopsis: string | null }
    | { op: "addEntryAttempt"; entryId: string; value: Omit<EntryValue, "category"> }
    | { op: "acceptEntry"; entryId: string; value: Omit<EntryValue, "category"> }
    | { op: "keepEntry"; entryId: string }
    | { op: "finishBible" }
    | { op: "editBriefDraft"; index: number; text: string }
    | { op: "editSynopsisDraft"; index: number; text: string }
    | { op: "editEntryDraft"; entryId: string; index: number; value: Omit<EntryValue, "category"> }
    | { op: "addOutlineAttempt"; chapterId: string; sourceSaveVersion: number; text: string; incomplete?: true }
    | {
          op: "addPieceAttempt";
          chapterId: string;
          /** The chapter version the piece was drafted from, and how many pieces it has. */
          sourceSaveVersion: number;
          pieceCount: number;
          index: number;
          text: string;
          incomplete?: true;
      }
    | { op: "editOutlineDraft"; chapterId: string; index: number; text: string }
    | { op: "editPieceDraft"; chapterId: string; piece: number; index: number; text: string }
    | { op: "acceptChapter"; chapterId: string; outline: string; rewrites: string[] }
    | { op: "finishChapters" };

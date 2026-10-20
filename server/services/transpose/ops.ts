import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
    pendingEntries,
    type Stage,
    type Transposition,
    type TranspositionState
} from "../../../src/v2/transpose/state.js";
import { schema } from "../../db/client.js";
import type { Tx } from "../stories/backup.js";

/** The changes a transposition takes (one at a time, each in its stage), and those for the brief, synopsis and bible. */

const text = z.string().trim().min(1).max(200_000);
const index = z.number().int().min(0);
const chapterId = z.string().min(1);
const entryValue = z.object({
    name: z.string().trim().min(1).max(500),
    description: z.string().max(50_000),
    tags: z.array(z.string().max(500)).max(100)
});

export const opSchema = z.discriminatedUnion("op", [
    z.object({ op: z.literal("addBriefAttempt"), text }),
    z.object({ op: z.literal("acceptBrief"), brief: text }),
    z.object({ op: z.literal("addSynopsisAttempt"), text }),
    // null: keep the synopsis as it is
    z.object({ op: z.literal("acceptSynopsis"), synopsis: text.nullable() }),
    z.object({ op: z.literal("addEntryAttempt"), entryId: z.string().min(1), value: entryValue }),
    z.object({ op: z.literal("acceptEntry"), entryId: z.string().min(1), value: entryValue }),
    z.object({ op: z.literal("keepEntry"), entryId: z.string().min(1) }),
    z.object({ op: z.literal("finishBible") }),
    // The writer's edits to a draft are kept like the draft itself
    z.object({ op: z.literal("editBriefDraft"), index, text }),
    z.object({ op: z.literal("editSynopsisDraft"), index, text }),
    z.object({ op: z.literal("editEntryDraft"), entryId: z.string().min(1), index, value: entryValue }),
    z.object({ op: z.literal("addOutlineAttempt"), chapterId, text }),
    z.object({ op: z.literal("editOutlineDraft"), chapterId, index, text }),
    z.object({
        op: z.literal("addPieceAttempt"),
        chapterId,
        sourceSaveVersion: index,
        pieceCount: z.number().int().min(1).max(1000),
        index,
        text
    }),
    z.object({ op: z.literal("editPieceDraft"), chapterId, piece: index, index, text }),
    z.object({
        op: z.literal("acceptChapter"),
        chapterId,
        outline: text,
        rewrites: z.array(z.string().max(200_000)).max(1000)
    }),
    z.object({ op: z.literal("finishChapters") })
]);

export type TranspositionOp = z.infer<typeof opSchema>;

/** Which stage each op belongs to: anything else is a stale screen acting on a layer already settled. */
export const OP_STAGE: Record<TranspositionOp["op"], Stage> = {
    addBriefAttempt: "brief",
    acceptBrief: "brief",
    addSynopsisAttempt: "synopsis",
    acceptSynopsis: "synopsis",
    addEntryAttempt: "bible",
    acceptEntry: "bible",
    keepEntry: "bible",
    finishBible: "bible",
    editBriefDraft: "brief",
    editSynopsisDraft: "synopsis",
    editEntryDraft: "bible",
    addOutlineAttempt: "chapters",
    editOutlineDraft: "chapters",
    addPieceAttempt: "chapters",
    editPieceDraft: "chapters",
    acceptChapter: "chapters",
    finishChapters: "chapters"
};

export type Outcome = { ok: true; transposition: Transposition } | { ok: false; status: number; error: string };

export const replaced = <T>(list: T[], at: number, value: T): T[] => list.map((item, i) => (i === at ? value : item));

export type Change = { state?: TranspositionState; brief?: string; stage?: Stage };
export type Failure = Extract<Outcome, { ok: false }>;
export const fail = (status: number, error: string): Failure => ({ ok: false, status, error });

export type Handlers = {
    [K in TranspositionOp["op"]]: (
        op: Extract<TranspositionOp, { op: K }>,
        state: TranspositionState,
        tx: Tx,
        storyId: string
    ) => Change | Failure;
};

const withEntry = (
    state: TranspositionState,
    entryId: string,
    change: (entry: TranspositionState["entries"][string]) => TranspositionState["entries"][string]
): TranspositionState => ({ ...state, entries: { ...state.entries, [entryId]: change(state.entries[entryId]) } });

/** Writes an entry's value into the copy's bible; false when it's gone. */
const writeEntry = (tx: Tx, storyId: string, entryId: string, value: z.infer<typeof entryValue>) =>
    tx
        .update(schema.lorebookEntries)
        .set({ name: value.name, description: value.description, tags: value.tags })
        .where(
            and(
                eq(schema.lorebookEntries.id, entryId),
                eq(schema.lorebookEntries.level, "story"),
                eq(schema.lorebookEntries.scopeId, storyId)
            )
        )
        .run().changes > 0;

export const STORY_HANDLERS: Pick<
    Handlers,
    | "addBriefAttempt"
    | "acceptBrief"
    | "addSynopsisAttempt"
    | "acceptSynopsis"
    | "addEntryAttempt"
    | "acceptEntry"
    | "keepEntry"
    | "finishBible"
    | "editBriefDraft"
    | "editSynopsisDraft"
    | "editEntryDraft"
> = {
    addBriefAttempt: (op, state) => ({ state: { ...state, briefAttempts: [...state.briefAttempts, op.text] } }),
    acceptBrief: op => ({ brief: op.brief, stage: "synopsis" }),
    addSynopsisAttempt: (op, state) => ({
        state: { ...state, synopsis: { ...state.synopsis, attempts: [...state.synopsis.attempts, op.text] } }
    }),
    acceptSynopsis: (op, _state, tx, storyId) => {
        if (op.synopsis !== null)
            tx.update(schema.stories).set({ synopsis: op.synopsis }).where(eq(schema.stories.id, storyId)).run();
        return { stage: "bible" };
    },
    addEntryAttempt: (op, state) => ({
        state: withEntry(state, op.entryId, entry => ({
            ...entry,
            attempts: [...entry.attempts, { ...op.value, category: entry.original.category }]
        }))
    }),
    acceptEntry: (op, state, tx, storyId) =>
        writeEntry(tx, storyId, op.entryId, op.value)
            ? { state: withEntry(state, op.entryId, entry => ({ ...entry, status: "accepted" })) }
            : fail(404, "That entry has been deleted from the story bible"),
    // Keeping after an accept puts the entry back as it was; otherwise it's left exactly as it is
    keepEntry: (op, state, tx, storyId) =>
        state.entries[op.entryId].status !== "accepted" ||
        writeEntry(tx, storyId, op.entryId, state.entries[op.entryId].original)
            ? { state: withEntry(state, op.entryId, entry => ({ ...entry, status: "kept" })) }
            : fail(404, "That entry has been deleted from the story bible"),
    finishBible: (_op, state) =>
        pendingEntries(state).length ? fail(409, "Some entries haven't been decided yet") : { stage: "chapters" },
    editBriefDraft: (op, state) =>
        op.index < state.briefAttempts.length
            ? { state: { ...state, briefAttempts: replaced(state.briefAttempts, op.index, op.text) } }
            : fail(404, "That draft doesn't exist"),
    editSynopsisDraft: (op, state) =>
        op.index < state.synopsis.attempts.length
            ? {
                  state: {
                      ...state,
                      synopsis: { ...state.synopsis, attempts: replaced(state.synopsis.attempts, op.index, op.text) }
                  }
              }
            : fail(404, "That draft doesn't exist"),
    editEntryDraft: (op, state) =>
        op.index < state.entries[op.entryId].attempts.length
            ? {
                  state: withEntry(state, op.entryId, entry => ({
                      ...entry,
                      attempts: replaced(entry.attempts, op.index, { ...op.value, category: entry.original.category })
                  }))
              }
            : fail(404, "That draft doesn't exist")
};

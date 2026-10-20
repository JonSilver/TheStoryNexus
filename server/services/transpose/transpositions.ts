import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
    initialState,
    pendingEntries,
    readStage,
    readState,
    syncEntries,
    type Stage,
    type Transposition,
    type TranspositionState
} from "../../../src/v2/transpose/state.js";
import { db, schema } from "../../db/client.js";
import { exportStoryBackup, restoreStory, type Tx } from "../stories/backup.js";

/**
 * A transposition (#77) always works on a copy: the original is never
 * touched. The copy leaves its series, taking the series' bible entries as
 * its own — they belong to other stories too, so only a copy of them may be
 * rewritten. Every accept writes the story and records the decision in one
 * transaction, so the two can't disagree.
 */

type Row = typeof schema.transpositions.$inferSelect;

// Until the bible is settled, the transposition follows the copy's live bible (syncEntries)
const FOLLOWS_BIBLE = new Set<Stage>(["brief", "synopsis", "bible"]);

const liveEntries = (q: Tx | typeof db, storyId: string) =>
    q
        .select()
        .from(schema.lorebookEntries)
        .where(and(eq(schema.lorebookEntries.level, "story"), eq(schema.lorebookEntries.scopeId, storyId)))
        .all()
        .map(entry => ({
            id: entry.id,
            name: entry.name,
            category: entry.category,
            description: entry.description,
            tags: Array.isArray(entry.tags) ? (entry.tags as string[]) : []
        }));

/** A stored row as the writer should see it now. */
export const readTransposition = (q: Tx | typeof db, row: Row): Transposition => {
    const stage = readStage(row.stage);
    const state = readState(row.state);
    return {
        id: row.id,
        storyId: row.storyId,
        sourceStoryId: row.sourceStoryId,
        target: row.target,
        brief: row.brief,
        stage,
        state: FOLLOWS_BIBLE.has(stage) ? syncEntries(state, liveEntries(q, row.storyId)) : state
    };
};

const TITLE_TARGET_CHARS = 60;

const shortTarget = (target: string) =>
    target.length <= TITLE_TARGET_CHARS ? target : `${target.slice(0, TITLE_TARGET_CHARS).replace(/\s+\S*$/, "")}…`;

export const createTransposition = async (sourceStoryId: string, target: string) => {
    const backup = await exportStoryBackup(sourceStoryId);
    if (!backup) return null;
    const seriesEntries = backup.story.seriesId
        ? await db
              .select()
              .from(schema.lorebookEntries)
              .where(
                  and(
                      eq(schema.lorebookEntries.level, "series"),
                      eq(schema.lorebookEntries.scopeId, backup.story.seriesId)
                  )
              )
        : [];
    const now = new Date();
    return restoreStory(
        // A copy of a transposed story starts afresh: its own transposition, not the earlier one's
        { ...backup, lorebookEntries: [...backup.lorebookEntries, ...seriesEntries], transposition: null },
        {
            seriesId: null,
            title: `${backup.story.title} (${shortTarget(target)})`,
            also: (tx, rows) =>
                tx
                    .insert(schema.transpositions)
                    .values({
                        id: crypto.randomUUID(),
                        storyId: rows.story.id,
                        sourceStoryId,
                        target,
                        stage: "brief",
                        state: initialState(
                            rows.story.synopsis ?? "",
                            rows.lorebookEntries.map(entry => ({
                                id: entry.id,
                                name: entry.name,
                                category: entry.category,
                                description: entry.description,
                                tags: (entry.tags as string[]) ?? []
                            }))
                        ),
                        createdAt: now,
                        updatedAt: now
                    })
                    .run()
        }
    );
};

export const getTransposition = async (storyId: string): Promise<Transposition | null> => {
    const [row] = await db.select().from(schema.transpositions).where(eq(schema.transpositions.storyId, storyId));
    return row ? readTransposition(db, row) : null;
};

const text = z.string().trim().min(1).max(200_000);
const index = z.number().int().min(0);
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
    z.object({ op: z.literal("editEntryDraft"), entryId: z.string().min(1), index, value: entryValue })
]);

type TranspositionOp = z.infer<typeof opSchema>;

/** Which stage each op belongs to: anything else is a stale screen acting on a layer already settled. */
const OP_STAGE: Record<TranspositionOp["op"], Stage> = {
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
    editEntryDraft: "bible"
};

type Outcome = { ok: true; transposition: Transposition } | { ok: false; status: number; error: string };

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

const replaced = <T>(list: T[], at: number, value: T): T[] => list.map((item, i) => (i === at ? value : item));

type Change = { state?: TranspositionState; brief?: string; stage?: Stage };
type Failure = Extract<Outcome, { ok: false }>;
const fail = (status: number, error: string): Failure => ({ ok: false, status, error });

type Handlers = {
    [K in TranspositionOp["op"]]: (
        op: Extract<TranspositionOp, { op: K }>,
        state: TranspositionState,
        tx: Tx,
        storyId: string
    ) => Change | Failure;
};

const HANDLERS: Handlers = {
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

export const applyOp = (storyId: string, op: TranspositionOp): Outcome =>
    db.transaction(tx => {
        const [row] = tx.select().from(schema.transpositions).where(eq(schema.transpositions.storyId, storyId)).all();
        if (!row) return fail(404, "This story isn't being transposed");
        const current = readTransposition(tx, row);
        if (current.stage !== OP_STAGE[op.op])
            return fail(409, `That step is finished — this transposition is at ${current.stage}`);
        if ("entryId" in op && !(op.entryId in current.state.entries))
            return fail(404, "That entry isn't part of this transposition");
        const handler = HANDLERS[op.op] as (
            op: TranspositionOp,
            ...rest: [TranspositionState, Tx, string]
        ) => Change | Failure;
        const change = handler(op, current.state, tx, storyId);
        if ("ok" in change) return change;
        const [saved] = tx
            .update(schema.transpositions)
            .set({
                ...(change.state && { state: change.state }),
                ...(change.brief !== undefined && { brief: change.brief }),
                ...(change.stage && { stage: change.stage }),
                updatedAt: new Date()
            })
            .where(eq(schema.transpositions.id, row.id))
            .returning()
            .all();
        return { ok: true, transposition: readTransposition(tx, saved) };
    });

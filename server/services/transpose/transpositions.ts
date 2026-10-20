import { and, eq } from "drizzle-orm";
import {
    initialState,
    readStage,
    readState,
    syncEntries,
    type Stage,
    type Transposition,
    type TranspositionState
} from "../../../src/v2/transpose/state.js";
import { db, schema } from "../../db/client.js";
import { exportStoryBackup, restoreStory, type Tx } from "../stories/backup.js";
import { CHAPTER_HANDLERS, chapterOf } from "./chapterOps.js";
import {
    type Change,
    type Failure,
    fail,
    type Handlers,
    OP_STAGE,
    type Outcome,
    STORY_HANDLERS,
    type TranspositionOp
} from "./ops.js";

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

const HANDLERS: Handlers = { ...STORY_HANDLERS, ...CHAPTER_HANDLERS };

export const applyOp = (storyId: string, op: TranspositionOp): Outcome =>
    db.transaction(tx => {
        const [row] = tx.select().from(schema.transpositions).where(eq(schema.transpositions.storyId, storyId)).all();
        if (!row) return fail(404, "This story isn't being transposed");
        const current = readTransposition(tx, row);
        if (current.stage !== OP_STAGE[op.op])
            return fail(409, `That step is finished — this transposition is at ${current.stage}`);
        if ("entryId" in op && !(op.entryId in current.state.entries))
            return fail(404, "That entry isn't part of this transposition");
        if ("chapterId" in op && !chapterOf(tx, storyId, op.chapterId))
            return fail(404, "No such chapter in this story");
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

import { and, eq } from "drizzle-orm";
import { piecesOf, prosePieces, rebuildChapter, wordCountOf } from "../../../src/v2/transpose/pieces.js";
import { type ChapterDraft, emptyChapter, type TranspositionState } from "../../../src/v2/transpose/state.js";
import { schema } from "../../db/client.js";
import { resolveChapterUpdate } from "../../lib/chapterUpdate.js";
import type { Tx } from "../stories/backup.js";
import { type Failure, fail, type Handlers, replaced } from "./ops.js";

/** The chapters layer: an outline, then each piece of prose, drafted; accepting writes the chapter. */

const withChapter = (
    state: TranspositionState,
    id: string,
    change: (chapter: ChapterDraft) => ChapterDraft
): TranspositionState => ({
    ...state,
    chapters: { ...state.chapters, [id]: change(state.chapters[id] ?? emptyChapter()) }
});

export const chapterOf = (tx: Tx, storyId: string, id: string) =>
    tx
        .select()
        .from(schema.chapters)
        .where(and(eq(schema.chapters.id, id), eq(schema.chapters.storyId, storyId)))
        .all()[0];

const CHANGED_SINCE_DRAFTED = "This chapter has changed since it was drafted — draft it again.";

/**
 * Writes an accepted chapter: each prose piece replaced by its rewrite, kept
 * nodes where they were, the transposed outline as its summary. Refused when
 * the chapter isn't the text the pieces were drafted from.
 */
const writeChapter = (
    tx: Tx,
    chapter: typeof schema.chapters.$inferSelect,
    draft: ChapterDraft,
    outline: string,
    rewrites: string[]
): Failure | null => {
    const pieces = piecesOf(chapter.content);
    const prose = prosePieces(pieces);
    const fits =
        prose.length === 0 ||
        (draft.sourceSaveVersion === chapter.saveVersion &&
            draft.pieces.length === prose.length &&
            rewrites.length === prose.length);
    if (!fits) return fail(409, CHANGED_SINCE_DRAFTED);
    const resolution = resolveChapterUpdate(
        chapter,
        {
            content: rebuildChapter(pieces, rewrites),
            wordCount: wordCountOf(rewrites),
            expectedSaveVersion: chapter.saveVersion
        },
        new Date()
    );
    if (resolution.outcome === "conflict" || resolution.outcome === "invalid") return fail(409, CHANGED_SINCE_DRAFTED);
    const updates = resolution.outcome === "apply" ? resolution.updates : {};
    tx.update(schema.chapters)
        .set({
            ...updates,
            summary: outline,
            // The outline describes the new prose, so the summary is fresh for it
            summarySourceRevision: (updates.revision as number | undefined) ?? chapter.revision,
            summaryLocked: false,
            updatedAt: new Date()
        })
        .where(eq(schema.chapters.id, chapter.id))
        .run();
    return null;
};

export const CHAPTER_HANDLERS: Pick<
    Handlers,
    "addOutlineAttempt" | "editOutlineDraft" | "addPieceAttempt" | "editPieceDraft" | "acceptChapter" | "finishChapters"
> = {
    addOutlineAttempt: (op, state) => ({
        state: withChapter(state, op.chapterId, chapter => ({
            ...chapter,
            outlineAttempts: [...chapter.outlineAttempts, op.text]
        }))
    }),
    editOutlineDraft: (op, state) =>
        op.index < (state.chapters[op.chapterId]?.outlineAttempts.length ?? 0)
            ? {
                  state: withChapter(state, op.chapterId, chapter => ({
                      ...chapter,
                      outlineAttempts: replaced(chapter.outlineAttempts, op.index, op.text)
                  }))
              }
            : fail(404, "That draft doesn't exist"),
    addPieceAttempt: (op, state) => {
        const draft = state.chapters[op.chapterId] ?? emptyChapter();
        if (draft.status === "accepted") return fail(409, "This chapter has already been accepted");
        if (op.index >= op.pieceCount) return fail(400, "No such part of the chapter");
        // Drafts fit the text they were made from: a changed chapter starts its pieces afresh
        const fresh = draft.sourceSaveVersion !== op.sourceSaveVersion || draft.pieces.length !== op.pieceCount;
        const pieces = fresh ? Array.from({ length: op.pieceCount }, (): string[] => []) : draft.pieces;
        return {
            state: withChapter(state, op.chapterId, chapter => ({
                ...chapter,
                sourceSaveVersion: op.sourceSaveVersion,
                pieces: replaced(pieces, op.index, [...pieces[op.index], op.text])
            }))
        };
    },
    editPieceDraft: (op, state) => {
        const drafts = state.chapters[op.chapterId]?.pieces[op.piece];
        return drafts && op.index < drafts.length
            ? {
                  state: withChapter(state, op.chapterId, chapter => ({
                      ...chapter,
                      pieces: replaced(chapter.pieces, op.piece, replaced(drafts, op.index, op.text))
                  }))
              }
            : fail(404, "That draft doesn't exist");
    },
    acceptChapter: (op, state, tx, storyId) => {
        const chapter = chapterOf(tx, storyId, op.chapterId);
        const draft = state.chapters[op.chapterId] ?? emptyChapter();
        if (draft.status === "accepted") return fail(409, "This chapter has already been accepted");
        const refused = chapter
            ? writeChapter(tx, chapter, draft, op.outline, op.rewrites)
            : fail(404, "No such chapter");
        return refused ?? { state: withChapter(state, op.chapterId, current => ({ ...current, status: "accepted" })) };
    },
    finishChapters: (_op, state, tx, storyId) => {
        const chapters = tx.select().from(schema.chapters).where(eq(schema.chapters.storyId, storyId)).all();
        return chapters.every(chapter => state.chapters[chapter.id]?.status === "accepted")
            ? { stage: "done" }
            : fail(409, "Some chapters haven't been accepted yet");
    }
};

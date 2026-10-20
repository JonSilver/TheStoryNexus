import type { Chapter } from "@/types/story";
import { piecesOf, prosePieces } from "./pieces";
import { emptyChapter, lastComplete, type TranspositionState } from "./state";

/** What drafting the remaining chapters will ask of the model: the writer sees it before anything is spent. */
export interface DraftPlan {
    chapters: number;
    outlines: number;
    parts: number;
    /** Words of the original to rewrite. */
    words: number;
    /** A part that will be drafted, to ask the server what one call costs and which model makes it. */
    sample: { chapterId: string; selection: string } | null;
}

// English prose averages about 1.35 tokens a word; an outline is a few hundred words
const TOKENS_PER_WORD = 1.35;
const OUTLINE_TOKENS = 550;

export const planDrafting = (chapters: Chapter[], state: TranspositionState): DraftPlan =>
    chapters
        .filter(chapter => state.chapters[chapter.id]?.status !== "accepted")
        .reduce<DraftPlan>(
            (plan, chapter) => {
                const draft = state.chapters[chapter.id] ?? emptyChapter();
                const version = chapter.saveVersion ?? 0;
                const pieces = prosePieces(piecesOf(chapter.content));
                const fits = draft.sourceSaveVersion === version && draft.pieces.length === pieces.length;
                const todo = pieces.filter((_, i) => !fits || !lastComplete(draft.pieces[i] ?? []));
                const outline = !(draft.outlineSourceSaveVersion === version && lastComplete(draft.outlineAttempts));
                if (!todo.length && !outline) return plan;
                return {
                    chapters: plan.chapters + 1,
                    outlines: plan.outlines + (outline ? 1 : 0),
                    parts: plan.parts + todo.length,
                    words: plan.words + todo.reduce((sum, piece) => sum + piece.words, 0),
                    sample: plan.sample ?? (todo[0] ? { chapterId: chapter.id, selection: todo[0].text } : null)
                };
            },
            { chapters: 0, outlines: 0, parts: 0, words: 0, sample: null }
        );

const rounded = (tokens: number) =>
    (tokens < 10_000 ? Math.ceil(tokens / 100) * 100 : Math.ceil(tokens / 1000) * 1000).toLocaleString();

/**
 * The plan in the writer's terms. `promptTokens` is what one sample call
 * sends (the brief, the bible and the part), so the rest of every call —
 * all but the part itself — is counted for each one.
 */
export const describePlan = (plan: DraftPlan, sample: { promptTokens: number; model: string }) => {
    const calls = plan.outlines + plan.parts;
    const partTokens = plan.words * TOKENS_PER_WORD;
    const typicalPart = plan.parts ? partTokens / plan.parts : 0;
    const overhead = Math.max(sample.promptTokens - typicalPart, 0);
    const sent = overhead * calls + partTokens;
    const received = partTokens + plan.outlines * OUTLINE_TOKENS;
    return (
        `Drafting ${plan.chapters} chapter${plan.chapters === 1 ? "" : "s"} takes about ${calls} model call${calls === 1 ? "" : "s"} ` +
        `(${plan.outlines} outline${plan.outlines === 1 ? "" : "s"}, ${plan.parts} part${plan.parts === 1 ? "" : "s"}) with ${sample.model}, ` +
        `sending roughly ${rounded(sent)} tokens and receiving roughly ${rounded(received)}. ` +
        "Stop keeps whatever's done; you can change the model in Settings → AI actions → Transpose: Chapter Prose."
    );
};

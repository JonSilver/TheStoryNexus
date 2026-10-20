import type { Chapter } from "@/types/story";
import { piecesOf, prosePieces } from "./pieces";
import { emptyChapter, lastComplete, type TranspositionState } from "./state";

/** What drafting the remaining chapters will ask of the model: the writer sees it before anything is spent. */
interface DraftPlan {
    chapters: number;
    outlines: number;
    parts: number;
    /** Words of the original to rewrite. */
    words: number;
    /** A part and a chapter that will be drafted, to ask the server what each kind of call sends, and to which model. */
    samplePart: { chapterId: string; selection: string; words: number } | null;
    sampleOutline: { chapterId: string } | null;
}

// English prose averages about 1.35 tokens a word; an outline is a few hundred words
const TOKENS_PER_WORD = 1.35;
const OUTLINE_TOKENS = 550;
// Every part is also sent its chapter's outline and the end of the part before (useChapterDrafting's 2,000 characters)
const CONTINUITY_TOKENS = 500;

/** Anything left for the model to draft. */
export const hasWork = (plan: DraftPlan) => plan.outlines + plan.parts > 0;

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
                    samplePart:
                        plan.samplePart ??
                        (todo[0] ? { chapterId: chapter.id, selection: todo[0].text, words: todo[0].words } : null),
                    sampleOutline: plan.sampleOutline ?? (outline ? { chapterId: chapter.id } : null)
                };
            },
            { chapters: 0, outlines: 0, parts: 0, words: 0, samplePart: null, sampleOutline: null }
        );

/** What one call of a kind sends (as priced by the server), and the model that makes it. */
export interface CallSample {
    promptTokens: number;
    model: string;
}

const rounded = (tokens: number) =>
    (tokens < 10_000 ? Math.ceil(tokens / 100) * 100 : Math.ceil(tokens / 1000) * 1000).toLocaleString();
const plural = (count: number, one: string) => `${count} ${one}${count === 1 ? "" : "s"}`;

/**
 * The plan in the writer's terms. Each kind of call is priced from its own
 * sample: a part's prompt is the brief, the bible, the outline and the end
 * of the part before (much the same for every part) plus the part itself, so
 * the sample's own part is taken off and each part's words put back.
 */
export const describePlan = (plan: DraftPlan, samples: { outline?: CallSample; part?: CallSample }) => {
    const partTokens = plan.words * TOKENS_PER_WORD;
    const partOverhead =
        samples.part && plan.samplePart
            ? Math.max(samples.part.promptTokens - plan.samplePart.words * TOKENS_PER_WORD, 0)
            : 0;
    // The sample is priced with a stand-in outline and no continuity: theirs are added, erring high
    const sent =
        (partOverhead + OUTLINE_TOKENS + CONTINUITY_TOKENS) * plan.parts +
        partTokens +
        (samples.outline?.promptTokens ?? 0) * plan.outlines;
    const received = partTokens + plan.outlines * OUTLINE_TOKENS;
    const models = [...new Set([samples.outline?.model, samples.part?.model].filter(Boolean))];
    const who =
        models.length > 1
            ? `outlines with ${samples.outline?.model}, parts with ${samples.part?.model}`
            : `with ${models[0] ?? "the default model"}`;
    return (
        `Drafting ${plural(plan.chapters, "chapter")} takes about ${plural(plan.outlines + plan.parts, "model call")} ` +
        `(${plural(plan.outlines, "outline")}, ${plural(plan.parts, "part")}) ${who}, ` +
        `sending roughly ${rounded(sent)} tokens and receiving roughly ${rounded(received)}. ` +
        "Stop keeps whatever's done; models are chosen in Settings → AI actions (Transpose: Chapter Outline and Chapter Prose)."
    );
};

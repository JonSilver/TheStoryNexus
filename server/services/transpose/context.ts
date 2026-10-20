import { inArray, eq } from "drizzle-orm";
import { countTokens } from "gpt-tokenizer";
import { piecesOf, prosePieces } from "../../../src/v2/transpose/pieces.js";
import { type EntryState, type EntryValue, lastComplete } from "../../../src/v2/transpose/state.js";
import { db, schema } from "../../db/client.js";
import type { ContextKey } from "../actions/registry.js";
import { matchEntries } from "../lorebook/matching.js";
import { readTransposition } from "./transpositions.js";

/**
 * Context for the transposition actions (#77): the target, the accepted
 * brief, the original synopsis, the bible as a map from each entry's
 * original to its transposed form, and every chapter's summary.
 */
export const TRANSPOSITION_KEYS: ContextKey[] = [
    "transposition_target",
    "transposition_brief",
    "story_synopsis",
    "story_bible",
    "story_summaries",
    "chapter_summary",
    "transposed_summaries"
];

type ChapterRow = typeof schema.chapters.$inferSelect;

const aliases = (tags: string[]) => (tags.length ? ` (also: ${tags.join(", ")})` : "");

const bibleLine = (entry: EntryState, now: EntryValue | null): string => {
    const { original } = entry;
    const was = `${original.name}${aliases(original.tags)} [${original.category}]`;
    if (entry.status === "accepted" && now) return `${was} → ${now.name}${aliases(now.tags)}: ${now.description}`;
    if (entry.status === "kept") return `${was}: ${original.description} (unchanged)`;
    return `${was}: ${original.description} (not transposed yet)`;
};

/** Whole lines, in order, while they fit. */
const linesWithin = (lines: string[], budget: number): string => {
    const kept: string[] = [];
    const left = { budget };
    for (const line of lines) {
        const cost = countTokens(line) + 1;
        if (cost > left.budget) break;
        left.budget -= cost;
        kept.push(line);
    }
    return kept.join("\n");
};

const CHAPTER_TEXT_SHARE = 0.5;

export const transpositionContext = async ({
    storyId,
    chapters,
    chapterId,
    selection,
    needs,
    budget
}: {
    storyId: string;
    chapters: ChapterRow[];
    chapterId?: string;
    /** A passage being rewritten: the bible is narrowed to the entries it mentions. */
    selection?: string;
    needs: Set<ContextKey>;
    budget: number;
}): Promise<Partial<Record<ContextKey, string>>> => {
    const [row] = await db.select().from(schema.transpositions).where(eq(schema.transpositions.storyId, storyId));
    if (!row) throw new Error("This story isn't being transposed — start from Transpose story on the original.");
    const { state } = readTransposition(db, row);
    const fixed: Partial<Record<ContextKey, string>> = {
        ...(needs.has("transposition_target") && { transposition_target: row.target }),
        ...(needs.has("transposition_brief") && { transposition_brief: row.brief ?? "" }),
        ...(needs.has("story_synopsis") && { story_synopsis: state.synopsis.original || "(no synopsis)" })
    };
    const left = { budget: budget - Object.values(fixed).reduce((sum, text) => sum + countTokens(text ?? ""), 0) };

    const bible = await (async () => {
        if (!needs.has("story_bible") || !state.entryOrder.length) return null;
        const rows = await db
            .select()
            .from(schema.lorebookEntries)
            .where(inArray(schema.lorebookEntries.id, state.entryOrder));
        const current = new Map(
            rows.map(entry => [
                entry.id,
                {
                    name: entry.name,
                    category: entry.category,
                    description: entry.description,
                    tags: Array.isArray(entry.tags) ? (entry.tags as string[]) : []
                }
            ])
        );
        // A passage names entries by their original names: match on those (and aliases)
        const mentioned = selection
            ? new Set(
                  matchEntries(
                      selection,
                      state.entryOrder.map(id => ({
                          id,
                          name: state.entries[id].original.name,
                          tags: state.entries[id].original.tags,
                          level: "story" as const
                      }))
                  ).map(match => match.entry.id)
              )
            : null;
        const lines = state.entryOrder
            .filter(id => !mentioned || mentioned.has(id))
            .map(id => bibleLine(state.entries[id], current.get(id) ?? null));
        // A passage that names no entries needs none
        if (!lines.length) return "(none of the bible's entries appear in this passage)";
        const text = linesWithin(lines, Math.floor(Math.max(left.budget, 0) * 0.5));
        // Rewriting without the bible would quietly lose the new setting's canon: say why instead
        if (!text) throw new Error("The brief is too long to leave room for the story bible — shorten the brief.");
        left.budget -= countTokens(text);
        return text;
    })();

    const summaries = needs.has("story_summaries")
        ? linesWithin(
              chapters
                  .filter(chapter => chapter.summary?.trim())
                  .sort((a, b) => a.order - b.order)
                  .map(chapter => `Chapter ${chapter.order + 1} (${chapter.title}): ${chapter.summary}`),
              Math.floor(Math.max(left.budget, 0) * 0.8)
          )
        : null;

    const chapter = chapterId ? chapters.find(c => c.id === chapterId) : undefined;
    const chapterSummary = (() => {
        if (!needs.has("chapter_summary") || !chapter) return null;
        if (chapter.summary?.trim()) return chapter.summary.trim();
        // No summary to work from: the chapter itself, its opening as much as fits
        const paragraphs = prosePieces(piecesOf(chapter.content)).flatMap(piece => piece.text.split("\n\n"));
        const share = Math.floor(Math.max(left.budget, 0) * CHAPTER_TEXT_SHARE);
        const fitted = linesWithin(paragraphs, share) || (paragraphs[0] ?? "").slice(0, share * 3);
        // Told "empty" about a chapter with prose, the model would invent one: say why instead
        if (paragraphs.length && !fitted)
            throw new Error("The brief and bible leave no room for this chapter — shorten the brief.");
        return fitted;
    })();
    if (chapterSummary) left.budget -= countTokens(chapterSummary);

    // The chapters before this one, as transposed so far: continuity in the new setting
    const transposed =
        needs.has("transposed_summaries") && chapter
            ? linesWithin(
                  chapters
                      .filter(c => c.order < chapter.order)
                      .sort((a, b) => b.order - a.order)
                      .map(c => {
                          const draft = state.chapters[c.id];
                          const outline =
                              draft?.status === "accepted"
                                  ? c.summary
                                  : draft && lastComplete(draft.outlineAttempts)?.text;
                          return outline ? `Chapter ${c.order + 1}: ${outline}` : null;
                      })
                      .filter((line): line is string => line !== null),
                  Math.floor(Math.max(left.budget, 0) * 0.5)
              )
                  .split("\n")
                  .reverse()
                  .join("\n")
            : null;

    return {
        ...fixed,
        ...(chapterSummary !== null && { chapter_summary: chapterSummary || "(this chapter is empty)" }),
        ...(transposed !== null && { transposed_summaries: transposed || "(this is the first chapter)" }),
        ...(needs.has("story_bible") && { story_bible: bible || "(no entries)" }),
        ...(summaries !== null && { story_summaries: summaries || "(no chapter summaries yet)" })
    };
};

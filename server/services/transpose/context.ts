import { inArray, eq } from "drizzle-orm";
import { countTokens } from "gpt-tokenizer";
import type { EntryState, EntryValue } from "../../../src/v2/transpose/state.js";
import { db, schema } from "../../db/client.js";
import type { ContextKey } from "../actions/registry.js";
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
    "story_summaries"
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

export const transpositionContext = async ({
    storyId,
    chapters,
    needs,
    budget
}: {
    storyId: string;
    chapters: ChapterRow[];
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
        const text = linesWithin(
            state.entryOrder.map(id => bibleLine(state.entries[id], current.get(id) ?? null)),
            Math.floor(Math.max(left.budget, 0) * 0.5)
        );
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

    return {
        ...fixed,
        ...(needs.has("story_bible") && { story_bible: bible || "(no entries)" }),
        ...(summaries !== null && { story_summaries: summaries || "(no chapter summaries yet)" })
    };
};

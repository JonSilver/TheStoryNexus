import { attempt } from "@jfdi/attempt";
import { and, eq, or } from "drizzle-orm";
import { countTokens } from "gpt-tokenizer";
import { parseSerialisedDocument } from "../../../src/v2/export/blocks.js";
import { blocksToPlainText } from "../../../src/v2/export/toPlainText.js";
import { db, schema } from "../../db/client.js";
import { matchEntries } from "../lorebook/matching.js";
import type { ContextKey } from "./registry.js";

type ChapterRow = typeof schema.chapters.$inferSelect;
type StoryRow = typeof schema.stories.$inferSelect;
type LorebookRow = typeof schema.lorebookEntries.$inferSelect;

export interface EditorContext {
    selection?: string;
    recentProse?: string;
    command?: string;
    povCharacter?: string;
    povType?: string;
    userMessage?: string;
    chatHistory?: string;
    guidance?: string;
}

export interface AssemblyInput {
    storyId: string;
    chapterId?: string;
    editorContext: EditorContext;
    contextNeeds: ContextKey[];
    tokenBudget: number;
}

export interface AssembledContext {
    context: Partial<Record<ContextKey, string>>;
    voice: string;
    story: StoryRow;
}

const PROSE_SHARE_OF_BUDGET = 0.6;

export const chapterPlainText = (content: string): string => {
    const [, text] = attempt(() => blocksToPlainText(parseSerialisedDocument(content)));
    return text ?? "";
};

const formatEntry = (entry: LorebookRow): string => `${entry.name} (${entry.category}): ${entry.description}`;

const formatPov = (povType?: string | null, povCharacter?: string | null): string =>
    [povType || "Third Person", povCharacter ? `(POV character: ${povCharacter})` : ""].filter(Boolean).join(" ");

// Trim to a token budget from the chosen end, cutting at a word boundary
const trimToTokens = (text: string, budget: number, keep: "head" | "tail"): string => {
    if (budget <= 0) return "";
    const shrink = (candidate: string, charBudget: number): string => {
        const slice = keep === "tail" ? candidate.slice(-charBudget) : candidate.slice(0, charBudget);
        const boundary = keep === "tail" ? slice.indexOf(" ") + 1 : slice.lastIndexOf(" ");
        return keep === "tail" ? slice.slice(boundary) : slice.slice(0, Math.max(boundary, 0));
    };
    // chars/token varies (CJK ≈1); shrink until the token count actually fits
    const state = { text, chars: budget * 4 };
    for (const _attempt of [0, 1, 2, 3]) {
        if (countTokens(state.text) <= budget) return state.text;
        state.text = shrink(state.text, state.chars);
        state.chars = Math.floor(state.chars / 2);
    }
    return countTokens(state.text) <= budget ? state.text : "";
};

const loadStoryEntries = async (story: StoryRow): Promise<LorebookRow[]> => {
    const table = schema.lorebookEntries;
    const conditions = [
        eq(table.level, "global"),
        and(eq(table.level, "story"), eq(table.scopeId, story.id)),
        ...(story.seriesId ? [and(eq(table.level, "series"), eq(table.scopeId, story.seriesId))] : [])
    ];
    return db
        .select()
        .from(table)
        .where(or(...conditions));
};

const summaryLine = (chapter: ChapterRow): string => {
    const stale = chapter.summarySourceRevision !== chapter.revision ? " [may be outdated]" : "";
    return `Chapter ${chapter.order + 1} (${chapter.title})${stale}: ${chapter.summary}`;
};

/**
 * Server-side context assembly (contracts §6, §10). Fills the action's
 * declared needs under the token budget with the degradation order:
 * fixed client-supplied text → recent prose (≤60% of remainder, tail-first)
 * → matched entries by rank → prior summaries nearest-first.
 */
export const assembleContext = async (input: AssemblyInput): Promise<AssembledContext> => {
    const { storyId, chapterId, editorContext, contextNeeds, tokenBudget } = input;
    const needs = new Set<ContextKey>(contextNeeds);

    const [story] = await db.select().from(schema.stories).where(eq(schema.stories.id, storyId));
    if (!story) throw new Error("Story not found");

    const chapters = await db.select().from(schema.chapters).where(eq(schema.chapters.storyId, storyId));
    const chapter = chapterId ? chapters.find(c => c.id === chapterId) : undefined;

    const context: Partial<Record<ContextKey, string>> = {};
    const remaining = { budget: tokenBudget };
    const spend = (text: string) => {
        remaining.budget -= countTokens(text);
        return text;
    };

    // Fixed, client-supplied slots first — never trimmed
    if (needs.has("selection") && editorContext.selection) context.selection = spend(editorContext.selection);
    if (needs.has("command") && editorContext.command) context.command = spend(editorContext.command);
    if (needs.has("user_message") && editorContext.userMessage) context.user_message = spend(editorContext.userMessage);
    if (needs.has("guidance") && editorContext.guidance) context.guidance = spend(editorContext.guidance);
    if (needs.has("pov"))
        context.pov = formatPov(
            editorContext.povType ?? chapter?.povType,
            editorContext.povCharacter ?? chapter?.povCharacter
        );
    if (needs.has("story_language")) context.story_language = story.language;

    if (needs.has("chapter_content") && chapter) {
        // The primary payload for summarise/extract, but still bounded: an
        // over-long chapter must degrade gracefully, not blow the window and
        // 422 the whole action. Keep head AND tail — a head-only trim made
        // summaries and continuity checks silently blind to chapter endings.
        const contentBudget = Math.floor(Math.max(remaining.budget, 0) * 0.85);
        const fullText = chapterPlainText(chapter.content);
        const fits = countTokens(fullText) <= contentBudget;
        context.chapter_content = spend(
            fits
                ? fullText
                : [
                      trimToTokens(fullText, Math.floor(contentBudget * 0.6), "head"),
                      "\n[... middle of chapter omitted to fit the model's context ...]\n",
                      trimToTokens(fullText, Math.floor(contentBudget * 0.35), "tail")
                  ].join("")
        );
    }

    if (needs.has("chat_history") && editorContext.chatHistory)
        context.chat_history = spend(
            trimToTokens(editorContext.chatHistory, Math.floor(remaining.budget * 0.5), "tail")
        );

    if (needs.has("recent_prose") && editorContext.recentProse) {
        const proseBudget = Math.floor(Math.max(remaining.budget, 0) * PROSE_SHARE_OF_BUDGET);
        context.recent_prose = spend(trimToTokens(editorContext.recentProse, proseBudget, "tail"));
    }

    if (needs.has("matched_entries")) {
        const rows = await loadStoryEntries(story);
        const entries = rows.map(row => ({
            ...row,
            tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
            level: row.level as "global" | "series" | "story"
        }));
        const searchText = [
            chapter ? chapterPlainText(chapter.content) : "",
            editorContext.command ?? "",
            editorContext.selection ?? "",
            editorContext.userMessage ?? "",
            editorContext.recentProse ?? "",
            editorContext.chatHistory ?? ""
        ].join("\n");
        const matches = matchEntries(searchText, entries);
        const lines: string[] = [];
        for (const match of matches) {
            const line = formatEntry(match.entry as unknown as LorebookRow);
            const cost = countTokens(line);
            if (cost > remaining.budget) break;
            remaining.budget -= cost;
            lines.push(line);
        }
        if (lines.length) context.matched_entries = lines.join("\n");
    }

    if (needs.has("summaries") && chapter) {
        const prior = chapters.filter(c => c.order < chapter.order && c.summary).sort((a, b) => b.order - a.order); // nearest first for budgeting
        const kept: ChapterRow[] = [];
        for (const c of prior) {
            const cost = countTokens(summaryLine(c));
            if (cost > remaining.budget) break;
            remaining.budget -= cost;
            kept.push(c);
        }
        if (kept.length)
            context.summaries = kept
                .sort((a, b) => a.order - b.order) // chronological in the prompt
                .map(summaryLine)
                .join("\n\n");
    }

    return { context, voice: story.aiInstructions ?? "", story };
};

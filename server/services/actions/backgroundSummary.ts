import { eq } from "drizzle-orm";
import { db, schema } from "../../db/client.js";
import { createRunWindow } from "../../lib/runWindow.js";

/**
 * The server is the single gate on background summaries, so every device
 * shares one allowance: a chapter revision is attempted at most once (the
 * claim is persisted and atomic), and the whole app runs at most
 * HOURLY_LIMIT of them per rolling hour. Manual summaries are not metered.
 */
const HOURLY_LIMIT = 6;
const HOUR_MS = 60 * 60_000;
const MIN_WORDS = 150;

// Process-wide; a server restart forgives the current hour, which at worst
// allows one extra hour's allowance
const budget = createRunWindow(HOURLY_LIMIT, HOUR_MS);

export type BackgroundClaim = { due: true; revision: number } | { due: false; reason: string };

export const claimBackgroundSummary = (chapterId: string, now = Date.now()): BackgroundClaim =>
    db.transaction(tx => {
        const chapter = tx.select().from(schema.chapters).where(eq(schema.chapters.id, chapterId)).get();
        if (!chapter) return { due: false, reason: "no such chapter" };
        if (chapter.summaryLocked) return { due: false, reason: "summary is the writer's" };
        if (chapter.summarySourceRevision === chapter.revision) return { due: false, reason: "summary is fresh" };
        if (chapter.wordCount < MIN_WORDS) return { due: false, reason: "chapter too short" };
        if (chapter.autoSummaryRevision === chapter.revision)
            return { due: false, reason: "already attempted for this revision" };

        if (!budget.tryTake(now)) return { due: false, reason: "hourly limit reached" };

        tx.update(schema.chapters)
            .set({ autoSummaryRevision: chapter.revision })
            .where(eq(schema.chapters.id, chapterId))
            .run();
        return { due: true, revision: chapter.revision };
    });

/** E2E seam: the window is process state shared by every test in a run. */
export const resetBackgroundBudget = () => budget.reset();

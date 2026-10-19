import { and, eq, type InferSelectModel, isNull, type SQL } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { resolveChapterUpdate } from "../lib/chapterUpdate.js";
import { createCrudRouter } from "../lib/crud.js";
import { parseJson } from "../lib/json.js";
import { claimBackgroundSummary, resetBackgroundBudget } from "../services/actions/backgroundSummary.js";

type Chapter = InferSelectModel<typeof schema.chapters>;

// revisionText is the server's change-measurement base, not chapter data
const afterRead = ({ revisionText: _revisionText, ...ch }: Chapter) => ({
    ...ch,
    outline: parseJson(ch.outline),
    notes: parseJson(ch.notes)
});

export default createCrudRouter({
    table: schema.chapters,
    name: "Chapter",
    parentKey: "storyId",
    transforms: { afterRead },
    customRoutes: (router, { asyncHandler }) => {
        // Background work asks first; the answer is shared by every device
        router.post("/:id/background-summary", (req, res) => {
            res.json(claimBackgroundSummary(req.params.id));
        });
        if (process.env.STORYNEXUS_E2E === "1")
            router.delete("/background-summary-budget", (_req, res) => {
                resetBackgroundBudget();
                res.status(204).end();
            });
        router.put(
            "/:id",
            asyncHandler(async (req, res) => {
                const [current] = await db.select().from(schema.chapters).where(eq(schema.chapters.id, req.params.id));
                if (!current) {
                    res.status(404).json({ error: "Chapter not found" });
                    return;
                }
                const resolution = resolveChapterUpdate(current, req.body, new Date());
                if (resolution.outcome === "invalid") {
                    res.status(400).json({ error: resolution.error });
                    return;
                }
                if (resolution.outcome === "unchanged") {
                    res.json(afterRead(current));
                    return;
                }
                if (resolution.outcome === "conflict") {
                    res.status(409).json({
                        error: "Chapter was modified elsewhere",
                        current: afterRead(current)
                    });
                    return;
                }
                // Atomic check-and-write, so racing writers can't both pass. A
                // background summary is pinned to its own revision, so it only
                // needs the summary it set out to replace to be still in place
                const guard = resolution.summaryGuard;
                const precondition: SQL = guard
                    ? and(
                          eq(schema.chapters.summaryLocked, false),
                          guard.expectedSourceRevision === null
                              ? isNull(schema.chapters.summarySourceRevision)
                              : eq(schema.chapters.summarySourceRevision, guard.expectedSourceRevision)
                      )!
                    : eq(schema.chapters.saveVersion, current.saveVersion);
                const [updated] = await db
                    .update(schema.chapters)
                    .set(resolution.updates)
                    .where(and(eq(schema.chapters.id, req.params.id), precondition))
                    .returning();
                if (!updated && guard) {
                    res.status(409).json({ error: "The summary changed while this one was being generated" });
                    return;
                }
                if (!updated) {
                    const [latest] = await db
                        .select()
                        .from(schema.chapters)
                        .where(eq(schema.chapters.id, req.params.id));
                    res.status(409).json({
                        error: "Chapter was modified elsewhere",
                        current: latest ? afterRead(latest) : null
                    });
                    return;
                }
                res.json(afterRead(updated));
            })
        );
    }
});

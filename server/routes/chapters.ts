import { and, eq, type InferSelectModel, isNull, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../db/client.js";
import { resolveChapterUpdate } from "../lib/chapterUpdate.js";
import { createCrudRouter } from "../lib/crud.js";
import { parseJson } from "../lib/json.js";
import { claimBackgroundSummary, resetBackgroundBudget } from "../services/actions/backgroundSummary.js";

type Chapter = InferSelectModel<typeof schema.chapters>;

const orderSchema = z.object({ ids: z.array(z.string()).max(10_000) });

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
        if (process.env.STORYNEXUS_E2E === "1" && process.env.NODE_ENV !== "production")
            router.delete("/background-summary-budget", (_req, res) => {
                resetBackgroundBudget();
                res.status(204).end();
            });
        // The story's whole running order in one write: per-chapter swaps could
        // half-land and leave two chapters sharing a place
        router.put("/story/:storyId/order", (req, res) => {
            const parsed = orderSchema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({ error: "Expected { ids: string[] }" });
                return;
            }
            const { ids } = parsed.data;
            const storyId = req.params.storyId;
            const rows = db.transaction(tx => {
                const current = tx.select().from(schema.chapters).where(eq(schema.chapters.storyId, storyId)).all();
                const known = new Set(current.map(ch => ch.id));
                if (ids.length !== known.size || new Set(ids).size !== ids.length || !ids.every(id => known.has(id)))
                    return null;
                const now = new Date();
                ids.forEach((id, order) => {
                    if (current.find(ch => ch.id === id)?.order !== order)
                        tx.update(schema.chapters)
                            .set({ order, updatedAt: now })
                            .where(eq(schema.chapters.id, id))
                            .run();
                });
                return tx.select().from(schema.chapters).where(eq(schema.chapters.storyId, storyId)).all();
            });
            if (!rows) {
                res.status(409).json({ error: "The chapter list changed — reload and try again" });
                return;
            }
            res.json(rows.map(afterRead).sort((a, b) => a.order - b.order));
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
                const preconditions: SQL[] = guard
                    ? [
                          eq(schema.chapters.summaryLocked, false),
                          guard.expectedSourceRevision === null
                              ? isNull(schema.chapters.summarySourceRevision)
                              : eq(schema.chapters.summarySourceRevision, guard.expectedSourceRevision)
                      ]
                    : [eq(schema.chapters.saveVersion, current.saveVersion)];
                const [updated] = await db
                    .update(schema.chapters)
                    .set(resolution.updates)
                    .where(and(eq(schema.chapters.id, req.params.id), ...preconditions))
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

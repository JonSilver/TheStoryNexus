import { and, eq, type InferSelectModel } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { resolveChapterUpdate } from "../lib/chapterUpdate.js";
import { createCrudRouter } from "../lib/crud.js";
import { parseJson } from "../lib/json.js";

type Chapter = InferSelectModel<typeof schema.chapters>;

const afterRead = (ch: Chapter) => ({
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
        router.put(
            "/:id",
            asyncHandler(async (req, res) => {
                const [current] = await db.select().from(schema.chapters).where(eq(schema.chapters.id, req.params.id));
                if (!current) {
                    res.status(404).json({ error: "Chapter not found" });
                    return;
                }
                const resolution = resolveChapterUpdate(current.revision, req.body, new Date());
                if (resolution.outcome === "conflict") {
                    res.status(409).json({
                        error: "Chapter was modified elsewhere",
                        current: afterRead(current)
                    });
                    return;
                }
                // Atomic optimistic concurrency: the revision predicate makes
                // check-and-write one statement, so racing writers can't both pass
                const [updated] = await db
                    .update(schema.chapters)
                    .set(resolution.updates)
                    .where(and(eq(schema.chapters.id, req.params.id), eq(schema.chapters.revision, current.revision)))
                    .returning();
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

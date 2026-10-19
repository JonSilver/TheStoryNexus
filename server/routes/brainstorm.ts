import { and, eq, type InferSelectModel } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { resolveChatUpdate } from "../lib/chatUpdate.js";
import { createCrudRouter } from "../lib/crud.js";
import { parseJson } from "../lib/json.js";

type AIChat = InferSelectModel<typeof schema.aiChats>;

const afterRead = (chat: AIChat) => ({ ...chat, messages: parseJson(chat.messages) });

export default createCrudRouter({
    table: schema.aiChats,
    name: "AI chat",
    parentKey: "storyId",
    transforms: { afterRead },
    customRoutes: (router, { asyncHandler }) => {
        router.put(
            "/:id",
            asyncHandler(async (req, res) => {
                const [current] = await db.select().from(schema.aiChats).where(eq(schema.aiChats.id, req.params.id));
                if (!current) {
                    res.status(404).json({ error: "AI chat not found" });
                    return;
                }
                const resolution = resolveChatUpdate(current.revision, req.body ?? {}, new Date());
                const conflict = (latest: AIChat | undefined) =>
                    res.status(409).json({
                        error: "This chat was changed elsewhere",
                        current: latest ? afterRead(latest) : null
                    });
                if (resolution.outcome === "conflict") {
                    conflict(current);
                    return;
                }
                // Atomic check-and-write: a racing writer on the same revision loses, not overwrites
                const [updated] = await db
                    .update(schema.aiChats)
                    .set(resolution.updates)
                    .where(
                        resolution.guarded
                            ? and(eq(schema.aiChats.id, req.params.id), eq(schema.aiChats.revision, current.revision))
                            : eq(schema.aiChats.id, req.params.id)
                    )
                    .returning();
                if (!updated) {
                    const [latest] = await db.select().from(schema.aiChats).where(eq(schema.aiChats.id, req.params.id));
                    conflict(latest);
                    return;
                }
                res.json(afterRead(updated));
            })
        );
    }
});

import { eq, isNull, or } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { createCrudRouter } from "../lib/crud.js";
import { parseJson } from "../lib/json.js";

type PromptRow = typeof schema.prompts.$inferSelect;

interface TransformedPrompt extends Omit<PromptRow, "messages" | "allowedModels"> {
    messages: unknown;
    allowedModels: unknown;
}

const transform = (p: PromptRow): TransformedPrompt => ({
    ...p,
    messages: parseJson(p.messages as string),
    allowedModels: parseJson(p.allowedModels as string)
});

export default createCrudRouter({
    table: schema.prompts,
    name: "Prompt",
    transforms: { afterRead: transform },
    customRoutes: (router, { asyncHandler, table }) => {
        // Custom GET with query filters
        router.get(
            "/",
            asyncHandler(async (req, res) => {
                const { storyId, promptType, includeSystem } = req.query;

                const query = storyId
                    ? db
                          .select()
                          .from(table)
                          .where(or(eq(table.storyId, storyId as string), isNull(table.storyId)))
                    : db.select().from(table);

                const allRows = await query;

                const filtered = allRows
                    .filter(p => !promptType || p.promptType === promptType)
                    .filter(p => includeSystem === "true" || !p.isSystem);

                res.json(filtered.map(transform));
            })
        );

        // Custom DELETE - prevent deleting system prompts
        router.delete(
            "/:id",
            asyncHandler(async (req, res) => {
                const [prompt] = await db.select().from(table).where(eq(table.id, req.params.id));
                if (prompt?.isSystem) {
                    res.status(403).json({ error: "Cannot delete system prompts" });
                    return;
                }
                await db.delete(table).where(eq(table.id, req.params.id));
                res.json({ success: true });
            })
        );
    }
});

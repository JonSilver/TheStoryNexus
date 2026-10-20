import { attemptPromise } from "@jfdi/attempt";
import { and, eq, isNull } from "drizzle-orm";
import express from "express";
import { z } from "zod";
import { db, schema } from "../db/client.js";
import { ACTION_IDS, BUILTIN_ACTIONS } from "../services/actions/registry.js";
import { validateTemplate } from "../services/actions/resolve.js";
import type { PromptMessage } from "../services/ai/providers.js";

const router = express.Router();

const asyncHandler =
    (fn: (req: express.Request, res: express.Response) => Promise<void>) =>
    async (req: express.Request, res: express.Response) => {
        const [error] = await attemptPromise(() => fn(req, res));
        if (error) {
            console.error("Actions error:", error);
            res.status(500).json({ error: error.message || "Server error" });
        }
    };

const overrideSchema = z.object({
    actionId: z.enum(ACTION_IDS),
    storyId: z.string().min(1).nullable(),
    template: z
        .array(z.object({ role: z.enum(["system", "user", "assistant"]), content: z.string().max(100_000) }))
        .min(1)
        .nullable()
        .optional(),
    temperature: z.number().min(0).max(2).nullable().optional(),
    maxTokens: z.number().int().min(64).max(65536).nullable().optional(),
    topP: z.number().min(0).max(1).nullable().optional(),
    frequencyPenalty: z.number().min(-2).max(2).nullable().optional(),
    presencePenalty: z.number().min(-2).max(2).nullable().optional(),
    modelRef: z
        .string()
        .regex(/^(openai|openrouter|gemini|local)::.+$/)
        .nullable()
        .optional()
});

// The registry itself: built-in definitions for the drawer to display
router.get("/registry", (_req, res) => {
    res.json(Object.values(BUILTIN_ACTIONS));
});

// Overrides for a scope: global (no storyId) or a story (global + story rows)
router.get(
    "/overrides",
    asyncHandler(async (req, res) => {
        const storyId = typeof req.query.storyId === "string" ? req.query.storyId : null;
        const table = schema.actionOverrides;
        const rows = storyId
            ? await db.select().from(table).where(eq(table.storyId, storyId))
            : await db.select().from(table).where(isNull(table.storyId));
        res.json(rows);
    })
);

// Upsert one override for (actionId, storyId-scope), field by field; template validated at save (§5)
router.put(
    "/overrides",
    asyncHandler(async (req, res) => {
        const parsed = overrideSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: "Invalid override", details: parsed.error.issues });
            return;
        }
        const { actionId, storyId, ...fields } = parsed.data;
        const { template } = fields;

        if (template) {
            const result = validateTemplate(template as PromptMessage[], BUILTIN_ACTIONS[actionId].contextNeeds);
            if (!result.valid) {
                res.status(422).json({
                    error: `Unknown template variables: ${result.unknownVariables.join(", ")}`,
                    unknownVariables: result.unknownVariables
                });
                return;
            }
        }

        const table = schema.actionOverrides;
        const scope = storyId
            ? and(eq(table.actionId, actionId), eq(table.storyId, storyId))
            : and(eq(table.actionId, actionId), isNull(table.storyId));
        // A field left out keeps what's stored (e.g. a model chosen from the sheet keeps the template); null clears it
        const given = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
        // Synchronous transaction makes the check-and-write atomic — the NULL
        // storyId scope can't be enforced by the unique index (SQLite treats
        // NULLs as distinct), so concurrent global saves must serialise here
        const row = db.transaction(tx => {
            const [existing] = tx.select().from(table).where(scope).all().slice(0, 1);
            if (existing)
                return Object.keys(given).length
                    ? tx.update(table).set(given).where(eq(table.id, existing.id)).returning().get()
                    : existing;
            return tx
                .insert(table)
                .values({ id: crypto.randomUUID(), actionId, storyId, createdAt: new Date(), ...given })
                .returning()
                .get();
        });
        res.json(row);
    })
);

// Reset to built-in: delete the override for the scope
router.delete(
    "/overrides/:actionId",
    asyncHandler(async (req, res) => {
        const actionId = req.params.actionId;
        if (!ACTION_IDS.includes(actionId as (typeof ACTION_IDS)[number])) {
            res.status(400).json({ error: "Unknown action" });
            return;
        }
        const storyId = typeof req.query.storyId === "string" ? req.query.storyId : null;
        const table = schema.actionOverrides;
        const scope = storyId
            ? and(eq(table.actionId, actionId), eq(table.storyId, storyId))
            : and(eq(table.actionId, actionId), isNull(table.storyId));
        await db.delete(table).where(scope);
        res.json({ success: true });
    })
);

export default router;

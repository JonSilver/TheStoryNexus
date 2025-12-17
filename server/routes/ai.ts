import { attemptPromise } from "@jfdi/attempt";
import { eq } from "drizzle-orm";
import express from "express";
import { db, schema } from "../db/client.js";

const router = express.Router();

const asyncHandler =
    (fn: (req: express.Request, res: express.Response) => Promise<void>) =>
    async (req: express.Request, res: express.Response) => {
        const [error] = await attemptPromise(() => fn(req, res));
        if (error) {
            console.error("Error:", error);
            res.status(500).json({ error: error.message || "Server error" });
        }
    };

router.get(
    "/settings",
    asyncHandler(async (_, res) => {
        const [settings] = await db.select().from(schema.aiSettings);
        if (!settings) {
            const initial = {
                id: crypto.randomUUID(),
                availableModels: [],
                createdAt: new Date()
            };
            await db.insert(schema.aiSettings).values(initial);
            res.json(initial);
            return;
        }
        res.json(settings);
    })
);

router.put(
    "/settings/:id",
    asyncHandler(async (req, res) => {
        const { id: _id, createdAt: _createdAt, lastModelsFetch, ...updates } = req.body;
        const result = await db
            .update(schema.aiSettings)
            .set({
                ...updates,
                ...(lastModelsFetch && { lastModelsFetch: new Date(lastModelsFetch) })
            })
            .where(eq(schema.aiSettings.id, req.params.id))
            .returning();
        const updated = Array.isArray(result) ? result[0] : result;
        res.json(updated);
    })
);

export default router;

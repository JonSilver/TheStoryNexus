import { attemptPromise } from "@jfdi/attempt";
import { eq } from "drizzle-orm";
import express from "express";
import { db, schema } from "../db/client.js";
import {
    type AIModel,
    type AIProviderId,
    DEFAULT_LOCAL_API_URL,
    fetchModelsForProvider,
    providerKeyField
} from "../services/ai/providers.js";

const router = express.Router();

type AISettingsRow = typeof schema.aiSettings.$inferSelect;

const asyncHandler =
    (fn: (req: express.Request, res: express.Response) => Promise<void>) =>
    async (req: express.Request, res: express.Response) => {
        const [error] = await attemptPromise(() => fn(req, res));
        if (error) {
            console.error("Error:", error);
            res.status(500).json({ error: error.message || "Server error" });
        }
    };

const SECRET_FIELDS = ["openaiKey", "openrouterKey", "geminiKey"] as const;

// Keys never leave the server: settings responses carry hasXxxKey booleans instead
export const redactSettings = (settings: AISettingsRow) => {
    const { openaiKey, openrouterKey, geminiKey, ...rest } = settings;
    return {
        ...rest,
        hasOpenaiKey: Boolean(openaiKey),
        hasOpenrouterKey: Boolean(openrouterKey),
        hasGeminiKey: Boolean(geminiKey)
    };
};

const getOrCreateSettings = async (): Promise<AISettingsRow> => {
    const [settings] = await db.select().from(schema.aiSettings);
    if (settings) return settings;
    const initial = {
        id: crypto.randomUUID(),
        availableModels: [] as AIModel[],
        createdAt: new Date()
    };
    await db.insert(schema.aiSettings).values(initial);
    const [created] = await db.select().from(schema.aiSettings);
    return created;
};

const mergeProviderModels = (existing: AIModel[], provider: AIProviderId, fresh: AIModel[]): AIModel[] => [
    ...existing.filter(m => m.provider !== provider),
    ...fresh
];

const refreshModels = async (settings: AISettingsRow, provider: AIProviderId): Promise<AISettingsRow> => {
    const fresh = await fetchModelsForProvider(provider, settings);
    const availableModels = mergeProviderModels((settings.availableModels as AIModel[]) ?? [], provider, fresh);
    // First working provider becomes the global default automatically
    const needsDefault = !settings.defaultProvider || !settings.defaultModelId;
    const defaults =
        needsDefault && fresh.length > 0 ? { defaultProvider: provider, defaultModelId: fresh[0].id } : {};
    const [updated] = await db
        .update(schema.aiSettings)
        .set({ availableModels, lastModelsFetch: new Date(), ...defaults })
        .where(eq(schema.aiSettings.id, settings.id))
        .returning();
    return updated;
};

router.get(
    "/settings",
    asyncHandler(async (_, res) => {
        res.json(redactSettings(await getOrCreateSettings()));
    })
);

router.put(
    "/settings/:id",
    asyncHandler(async (req, res) => {
        const { id: _id, createdAt: _createdAt, lastModelsFetch, ...updates } = req.body;
        // Secrets only enter via the write-only key endpoint
        SECRET_FIELDS.forEach(field => delete updates[field]);
        delete updates.hasOpenaiKey;
        delete updates.hasOpenrouterKey;
        delete updates.hasGeminiKey;
        const [updated] = await db
            .update(schema.aiSettings)
            .set({
                ...updates,
                ...(lastModelsFetch && { lastModelsFetch: new Date(lastModelsFetch) })
            })
            .where(eq(schema.aiSettings.id, req.params.id))
            .returning();
        res.json(redactSettings(updated));
    })
);

// Write-only: stores the key, validates it by fetching models, auto-selects a default model
router.put(
    "/keys/:provider",
    asyncHandler(async (req, res) => {
        const provider = req.params.provider as Exclude<AIProviderId, "local">;
        if (!["openai", "openrouter", "gemini"].includes(provider)) {
            res.status(400).json({ error: `Unknown provider: ${provider}` });
            return;
        }
        const { key } = req.body ?? {};
        if (typeof key !== "string" || !key.trim()) {
            res.status(400).json({ error: "Key required" });
            return;
        }
        const settings = await getOrCreateSettings();
        const [stored] = await db
            .update(schema.aiSettings)
            .set({ [providerKeyField(provider)]: key.trim() })
            .where(eq(schema.aiSettings.id, settings.id))
            .returning();
        const [error, updated] = await attemptPromise(() => refreshModels(stored, provider));
        if (error) {
            res.status(422).json({ error: `Key stored but model fetch failed: ${error.message}` });
            return;
        }
        res.json(redactSettings(updated));
    })
);

router.put(
    "/local-url",
    asyncHandler(async (req, res) => {
        const { url } = req.body ?? {};
        const candidate = typeof url === "string" && url.trim() ? url.trim() : DEFAULT_LOCAL_API_URL;
        const [parseError, parsed] = await attemptPromise(() => Promise.resolve(new URL(candidate)));
        if (parseError || !["http:", "https:"].includes(parsed.protocol)) {
            res.status(400).json({ error: "Local API URL must be http(s)" });
            return;
        }
        const settings = await getOrCreateSettings();
        const [stored] = await db
            .update(schema.aiSettings)
            .set({ localApiUrl: candidate })
            .where(eq(schema.aiSettings.id, settings.id))
            .returning();
        const [error, updated] = await attemptPromise(() => refreshModels(stored, "local"));
        if (error) {
            res.status(422).json({ error: `URL stored but connection failed: ${error.message}` });
            return;
        }
        res.json(redactSettings(updated));
    })
);

router.post(
    "/models/refresh/:provider",
    asyncHandler(async (req, res) => {
        const provider = req.params.provider as AIProviderId;
        if (!["openai", "openrouter", "gemini", "local"].includes(provider)) {
            res.status(400).json({ error: `Unknown provider: ${provider}` });
            return;
        }
        const settings = await getOrCreateSettings();
        const [error, updated] = await attemptPromise(() => refreshModels(settings, provider));
        if (error) {
            res.status(422).json({ error: `Model fetch failed: ${error.message}` });
            return;
        }
        res.json(redactSettings(updated));
    })
);

export default router;

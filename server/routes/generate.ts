import { attemptPromise } from "@jfdi/attempt";
import { eq } from "drizzle-orm";
import express from "express";
import { countTokens } from "gpt-tokenizer";
import { z } from "zod";
import { db, schema } from "../db/client.js";
import { assembleContext } from "../services/actions/context.js";
import { ACTION_IDS } from "../services/actions/registry.js";
import { type ActionOverrideRow, renderTemplate, resolveAction } from "../services/actions/resolve.js";
import { type AIProviderId, type PromptMessage, streamCompletion } from "../services/ai/providers.js";

const router = express.Router();

const activeGenerations = new Map<string, AbortController>();

const INACTIVITY_TIMEOUT_MS = 120_000;
const BUDGET_SAFETY_MARGIN = 256;

const PROVIDER_CONTEXT_DEFAULTS: Record<AIProviderId, number> = {
    openai: 16384,
    openrouter: 16384,
    gemini: 32768,
    local: 16384
};

const providerEnum = z.enum(["openai", "openrouter", "gemini", "local"]);

const rawRequestSchema = z.object({
    requestId: z.string().uuid(),
    provider: providerEnum,
    modelId: z.string().min(1).max(200),
    messages: z
        .array(z.object({ role: z.enum(["system", "user", "assistant"]), content: z.string().max(500_000) }))
        .min(1)
        .max(200),
    temperature: z.number().min(0).max(2).default(1),
    maxTokens: z.number().int().positive().max(65536).default(2048)
});

const actionRequestSchema = z.object({
    requestId: z.string().uuid(),
    actionId: z.enum(ACTION_IDS),
    storyId: z.string().min(1),
    chapterId: z.string().optional(),
    editorContext: z
        .object({
            selection: z.string().max(200_000),
            recentProse: z.string().max(500_000),
            command: z.string().max(20_000),
            povCharacter: z.string().max(200),
            povType: z.string().max(100),
            userMessage: z.string().max(100_000),
            chatHistory: z.string().max(500_000)
        })
        .partial()
        .default({}),
    modelRef: z.object({ provider: providerEnum, modelId: z.string().min(1).max(200) }).optional()
});

const sendEvent = (res: express.Response, event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};

type Settings = typeof schema.aiSettings.$inferSelect;

const loadSettings = async (): Promise<Settings | null> => {
    const [error, rows] = await attemptPromise(() => db.select().from(schema.aiSettings));
    return error ? null : (rows?.[0] ?? null);
};

const contextLimitFor = (settings: Settings, provider: AIProviderId, modelId: string): number => {
    const models = (settings.availableModels ?? []) as Array<{ id: string; provider: string; contextLength?: number }>;
    const model = models.find(m => m.provider === provider && m.id === modelId);
    return model?.contextLength || PROVIDER_CONTEXT_DEFAULTS[provider];
};

const voiceFor = async (storyId: string): Promise<string> => {
    const [, rows] = await attemptPromise(() =>
        db.select({ aiInstructions: schema.stories.aiInstructions }).from(schema.stories).where(eq(schema.stories.id, storyId))
    );
    return rows?.[0]?.aiInstructions ?? "";
};

const parseModelRef = (ref: string | null | undefined): { provider: AIProviderId; modelId: string } | null => {
    if (!ref) return null;
    const [provider, ...rest] = ref.split("::");
    const modelId = rest.join("::");
    return providerEnum.safeParse(provider).success && modelId
        ? { provider: provider as AIProviderId, modelId }
        : null;
};

/**
 * Shared streaming tail: abort registry entry + close handler must already
 * exist. Streams tokens, enforces the inactivity timeout, emits the terminal
 * frame, and cleans up.
 */
const streamToClient = async (
    res: express.Response,
    requestId: string,
    abortController: AbortController,
    settings: Settings,
    request: {
        provider: AIProviderId;
        modelId: string;
        messages: PromptMessage[];
        temperature: number;
        maxTokens: number;
        topP?: number;
        frequencyPenalty?: number;
        presencePenalty?: number;
    }
) => {
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no"
    });
    res.flushHeaders();

    const inactivity = { timedOut: false, timer: setTimeout(() => undefined, 0) };
    const armInactivityTimer = () => {
        clearTimeout(inactivity.timer);
        inactivity.timer = setTimeout(() => {
            inactivity.timedOut = true;
            abortController.abort();
        }, INACTIVITY_TIMEOUT_MS);
    };
    armInactivityTimer();

    const [error] = await attemptPromise(async () => {
        const stream = streamCompletion({ ...request, signal: abortController.signal }, settings);
        for await (const token of stream) {
            armInactivityTimer();
            sendEvent(res, "token", { text: token });
        }
    });

    clearTimeout(inactivity.timer);
    activeGenerations.delete(requestId);

    if (inactivity.timedOut) sendEvent(res, "error", { message: "Generation timed out (no output from provider)" });
    else if (error)
        if ((error as Error).name === "AbortError" || abortController.signal.aborted) sendEvent(res, "aborted", {});
        else sendEvent(res, "error", { message: (error as Error).message || "Generation failed" });
    else sendEvent(res, "finish", { reason: abortController.signal.aborted ? "aborted" : "complete" });

    res.end();
};

const registerGeneration = (res: express.Response, requestId: string): AbortController | null => {
    if (activeGenerations.has(requestId)) return null;
    const abortController = new AbortController();
    activeGenerations.set(requestId, abortController);
    // Registered before any await so an early disconnect can't leak the entry
    res.on("close", () => {
        abortController.abort();
        activeGenerations.delete(requestId);
    });
    return abortController;
};

// Raw-messages mode: v1 frontend compatibility until cutover
router.post("/", async (req, res) => {
    const parsed = rawRequestSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid generation request", details: parsed.error.issues });
        return;
    }
    const { requestId, provider, modelId, messages, temperature, maxTokens } = parsed.data;

    const abortController = registerGeneration(res, requestId);
    if (!abortController) {
        res.status(409).json({ error: "requestId already in use" });
        return;
    }

    const settings = await loadSettings();
    if (!settings) {
        activeGenerations.delete(requestId);
        res.status(500).json({ error: "AI settings unavailable" });
        return;
    }
    if (abortController.signal.aborted) {
        activeGenerations.delete(requestId);
        return;
    }

    await streamToClient(res, requestId, abortController, settings, {
        provider: provider as AIProviderId,
        modelId,
        messages,
        temperature,
        maxTokens
    });
});

// Action mode (contracts §5–§6): server owns templates, context, budgeting
router.post("/action", async (req, res) => {
    const parsed = actionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid action request", details: parsed.error.issues });
        return;
    }
    const { requestId, actionId, storyId, chapterId, editorContext, modelRef } = parsed.data;

    const abortController = registerGeneration(res, requestId);
    if (!abortController) {
        res.status(409).json({ error: "requestId already in use" });
        return;
    }
    const cleanup = () => activeGenerations.delete(requestId);

    const settings = await loadSettings();
    if (!settings) {
        cleanup();
        res.status(500).json({ error: "AI settings unavailable" });
        return;
    }

    const [overridesError, overrideRows] = await attemptPromise(() =>
        db.select().from(schema.actionOverrides).where(eq(schema.actionOverrides.actionId, actionId))
    );
    if (overridesError) {
        cleanup();
        res.status(500).json({ error: "Failed to load action overrides" });
        return;
    }
    const overrides = (overrideRows ?? []).map(row => ({
        ...row,
        template: row.template as PromptMessage[] | null
    })) as ActionOverrideRow[];

    const resolved = resolveAction(actionId, storyId, overrides);

    const model =
        modelRef ??
        parseModelRef(resolved.modelRef) ??
        (settings.defaultProvider && settings.defaultModelId
            ? { provider: settings.defaultProvider as AIProviderId, modelId: settings.defaultModelId }
            : null);
    if (!model) {
        cleanup();
        res.status(422).json({ error: "No model configured — add a provider key in Settings" });
        return;
    }

    const contextLimit = contextLimitFor(settings, model.provider, model.modelId);
    // Output may not consume more than half the window; the hard §10 guarantee
    // is enforced after rendering, not papered over with a floor
    const maxTokens = Math.min(resolved.params.maxTokens, Math.floor(contextLimit / 2));
    const voiceSize = resolved.def.voiceApplies ? countTokens(await voiceFor(storyId)) : 0;
    const templateSize = countTokens(resolved.template.map(m => m.content).join("\n")) + voiceSize;
    const tokenBudget = contextLimit - maxTokens - templateSize - BUDGET_SAFETY_MARGIN;
    if (tokenBudget <= 0) {
        cleanup();
        res.status(422).json({ error: "Prompt template and output size exceed the model's context window" });
        return;
    }

    const [assemblyError, assembled] = await attemptPromise(() =>
        assembleContext({ storyId, chapterId, editorContext, contextNeeds: resolved.def.contextNeeds, tokenBudget })
    );
    if (assemblyError || !assembled) {
        cleanup();
        res.status(422).json({ error: assemblyError?.message || "Context assembly failed" });
        return;
    }

    if (abortController.signal.aborted) {
        cleanup();
        return;
    }

    const messages = renderTemplate(
        resolved.template,
        assembled.context,
        resolved.def.voiceApplies ? assembled.voice : undefined
    );
    const promptTokens = countTokens(messages.map(m => m.content).join("\n"));
    if (promptTokens + maxTokens > contextLimit) {
        cleanup();
        res.status(422).json({ error: "Assembled prompt exceeds the model's context window" });
        return;
    }

    await streamToClient(res, requestId, abortController, settings, {
        provider: model.provider,
        modelId: model.modelId,
        messages,
        temperature: resolved.params.temperature,
        topP: resolved.params.topP,
        frequencyPenalty: resolved.params.frequencyPenalty,
        presencePenalty: resolved.params.presencePenalty,
        maxTokens
    });
});

// Inspector: the exact messages an action request would send, without generating
router.post("/preview", async (req, res) => {
    const parsed = actionRequestSchema.omit({ requestId: true }).safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid preview request", details: parsed.error.issues });
        return;
    }
    const { actionId, storyId, chapterId, editorContext, modelRef } = parsed.data;

    const settings = await loadSettings();
    if (!settings) {
        res.status(500).json({ error: "AI settings unavailable" });
        return;
    }
    const [overridesError, overrideRows] = await attemptPromise(() =>
        db.select().from(schema.actionOverrides).where(eq(schema.actionOverrides.actionId, actionId))
    );
    if (overridesError) {
        res.status(500).json({ error: "Failed to load action overrides" });
        return;
    }
    const overrides = (overrideRows ?? []).map(row => ({
        ...row,
        template: row.template as PromptMessage[] | null
    })) as ActionOverrideRow[];
    const resolved = resolveAction(actionId, storyId, overrides);

    const model =
        modelRef ??
        parseModelRef(resolved.modelRef) ??
        (settings.defaultProvider && settings.defaultModelId
            ? { provider: settings.defaultProvider as AIProviderId, modelId: settings.defaultModelId }
            : null);

    // The inspector must show EXACTLY what generation would send — identical
    // budget arithmetic, including the output cap and voice cost
    const contextLimit = model ? contextLimitFor(settings, model.provider, model.modelId) : 16384;
    const maxTokens = Math.min(resolved.params.maxTokens, Math.floor(contextLimit / 2));
    const voiceSize = resolved.def.voiceApplies ? countTokens(await voiceFor(storyId)) : 0;
    const templateSize = countTokens(resolved.template.map(m => m.content).join("\n")) + voiceSize;
    const tokenBudget = contextLimit - maxTokens - templateSize - BUDGET_SAFETY_MARGIN;
    if (tokenBudget <= 0) {
        res.status(422).json({ error: "Prompt template and output size exceed the model's context window" });
        return;
    }

    const [assemblyError, assembled] = await attemptPromise(() =>
        assembleContext({ storyId, chapterId, editorContext, contextNeeds: resolved.def.contextNeeds, tokenBudget })
    );
    if (assemblyError || !assembled) {
        res.status(422).json({ error: assemblyError?.message || "Context assembly failed" });
        return;
    }

    const messages = renderTemplate(
        resolved.template,
        assembled.context,
        resolved.def.voiceApplies ? assembled.voice : undefined
    );
    res.json({
        model,
        params: { ...resolved.params, maxTokens },
        promptTokens: countTokens(messages.map(m => m.content).join("\n")),
        messages
    });
});

router.post("/abort", (req, res) => {
    const { requestId } = req.body ?? {};
    const controller = typeof requestId === "string" ? activeGenerations.get(requestId) : undefined;
    if (controller) {
        controller.abort();
        activeGenerations.delete(requestId);
    }
    res.json({ aborted: Boolean(controller) });
});

export default router;

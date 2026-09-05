import { attemptPromise } from "@jfdi/attempt";
import express from "express";
import { z } from "zod";
import { db, schema } from "../db/client.js";
import { type AIProviderId, streamCompletion } from "../services/ai/providers.js";

const router = express.Router();

const activeGenerations = new Map<string, AbortController>();

const generateRequestSchema = z.object({
    requestId: z.string().min(1),
    provider: z.enum(["openai", "openrouter", "gemini", "local"]),
    modelId: z.string().min(1),
    messages: z
        .array(z.object({ role: z.enum(["system", "user", "assistant"]), content: z.string() }))
        .min(1),
    temperature: z.number().min(0).max(2).default(1),
    maxTokens: z.number().int().positive().max(65536).default(2048)
});

const sendEvent = (res: express.Response, event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};

router.post("/", async (req, res) => {
    const parsed = generateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid generation request", details: parsed.error.issues });
        return;
    }
    const { requestId, provider, modelId, messages, temperature, maxTokens } = parsed.data;

    const [settingsError, settingsRows] = await attemptPromise(() => db.select().from(schema.aiSettings));
    if (settingsError || !settingsRows?.[0]) {
        res.status(500).json({ error: "AI settings unavailable" });
        return;
    }
    const settings = settingsRows[0];

    const abortController = new AbortController();
    activeGenerations.set(requestId, abortController);

    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no"
    });
    res.flushHeaders();

    // Abort upstream when the client disconnects mid-stream
    res.on("close", () => {
        abortController.abort();
        activeGenerations.delete(requestId);
    });

    const [error] = await attemptPromise(async () => {
        const stream = streamCompletion(
            {
                provider: provider as AIProviderId,
                modelId,
                messages,
                temperature,
                maxTokens,
                signal: abortController.signal
            },
            settings
        );
        for await (const token of stream) sendEvent(res, "token", { text: token });
    });

    activeGenerations.delete(requestId);

    if (error)
        if ((error as Error).name === "AbortError" || abortController.signal.aborted) sendEvent(res, "aborted", {});
        else sendEvent(res, "error", { message: (error as Error).message || "Generation failed" });
    else sendEvent(res, "finish", { reason: abortController.signal.aborted ? "aborted" : "complete" });

    res.end();
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

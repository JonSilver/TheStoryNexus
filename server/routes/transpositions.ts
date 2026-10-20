import { attemptPromise } from "@jfdi/attempt";
import express from "express";
import { z } from "zod";
import { opSchema } from "../services/transpose/ops.js";
import { applyOp, createTransposition, getTransposition } from "../services/transpose/transpositions.js";

const router = express.Router();

const MAX_TARGET_CHARS = 100_000;
const createSchema = z.object({
    sourceStoryId: z.string().min(1),
    target: z.string().trim().min(1).max(MAX_TARGET_CHARS)
});

// Start: a copy of the story, set to be transposed (the original is never touched)
router.post("/", async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
        // Say what's actually wrong: an empty box and an over-long one are different problems
        const target = typeof req.body?.target === "string" ? req.body.target.trim() : "";
        res.status(400).json({
            error: !target
                ? "Say where and when the story should be set, or paste a brief."
                : target.length > MAX_TARGET_CHARS
                  ? `That's ${target.length.toLocaleString("en-GB")} characters — the most a brief can be is ${MAX_TARGET_CHARS.toLocaleString("en-GB")}.`
                  : "Couldn't start: the request was incomplete."
        });
        return;
    }
    const [error, copy] = await attemptPromise(() =>
        createTransposition(parsed.data.sourceStoryId, parsed.data.target)
    );
    if (error) {
        console.error("Error starting a transposition:", error);
        res.status(500).json({ error: "Couldn't make the copy to transpose", details: error.message });
        return;
    }
    if (!copy) {
        res.status(404).json({ error: "Story not found" });
        return;
    }
    res.status(201).json(copy);
});

router.get("/:storyId", async (req, res) => {
    const [error, transposition] = await attemptPromise(() => getTransposition(req.params.storyId));
    if (error) {
        res.status(500).json({ error: "Couldn't read the transposition", details: error.message });
        return;
    }
    // Most stories aren't being transposed: that's an answer (null), not an error
    res.json(transposition);
});

// One change at a time, applied to what's stored — never a whole state from a stale screen
router.post("/:storyId/ops", async (req, res) => {
    const parsed = opSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid transposition change", details: parsed.error.issues });
        return;
    }
    const [error, outcome] = await attemptPromise(async () => applyOp(req.params.storyId, parsed.data));
    if (error) {
        console.error("Error saving a transposition change:", error);
        res.status(500).json({ error: "Couldn't save that", details: error.message });
        return;
    }
    if (!outcome.ok) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
    }
    res.json(outcome.transposition);
});

export default router;

import { describe, expect, it } from "vitest";
import { BUILTIN_ACTIONS, PROSE_ONLY } from "./registry";

// Their replies go straight into the manuscript: a model's notes or a list of changes must never ride along
const PROSE_ACTIONS = ["scene_beat", "continue", "rework", "expand", "shorten", "ask"] as const;

describe("prose actions", () => {
    it.each(PROSE_ACTIONS)("%s asks for the prose and nothing else", actionId => {
        const system = BUILTIN_ACTIONS[actionId].defaultTemplate.find(message => message.role === "system");
        expect(system?.content.endsWith(PROSE_ONLY)).toBe(true);
    });
});

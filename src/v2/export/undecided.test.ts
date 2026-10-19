import { describe, expect, it } from "vitest";
import { countUndecided } from "./undecided";

const doc = (children: unknown[]) => JSON.stringify({ root: { type: "root", children } });

describe("countUndecided", () => {
    it("counts beats with unaccepted takes and pending ghosts", () => {
        const serialised = doc([
            { type: "scene-beat-v2", status: "done", takes: ["a take"] },
            { type: "scene-beat-v2", status: "accepted", takes: ["kept"] },
            { type: "scene-beat-v2", status: "idle" },
            { type: "suggestion-v2", text: "a pending continuation" },
            { type: "suggestion-v2", text: "  " },
            { type: "paragraph", children: [{ type: "text", text: "prose" }] }
        ]);
        expect(countUndecided(serialised)).toBe(2);
    });

    it("counts legacy single-draft beats", () => {
        expect(countUndecided(doc([{ type: "scene-beat-v2", status: "done", generatedText: "old draft" }]))).toBe(1);
    });

    it("returns zero for clean documents and garbage input", () => {
        expect(countUndecided(doc([{ type: "paragraph", children: [] }]))).toBe(0);
        expect(countUndecided("not json")).toBe(0);
        expect(countUndecided("")).toBe(0);
    });
});

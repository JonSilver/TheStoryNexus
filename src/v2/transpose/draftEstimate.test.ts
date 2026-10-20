import { describe, expect, it } from "vitest";
import { describePlan } from "./draftEstimate";

const plan = {
    chapters: 2,
    outlines: 2,
    parts: 4,
    words: 4000,
    samplePart: { chapterId: "c1", selection: "…", words: 1000 },
    sampleOutline: { chapterId: "c1" }
};

describe("draft estimate", () => {
    it("prices each kind of call from its own sample, and names both models when they differ", () => {
        const text = describePlan(plan, {
            outline: { promptTokens: 3000, model: "gpt-big" },
            // 1,350 of these are the sample part itself; the rest (2,000) goes with every part
            part: { promptTokens: 3350, model: "local-small" }
        });
        expect(text).toContain(
            "about 6 model calls (2 outlines, 4 parts) outlines with gpt-big, parts with local-small"
        );
        // 4 × (2,000 + 550 outline + 500 continuity) + 5,400 (the parts) + 2 × 3,000 (the outlines) = 23,600
        expect(text).toContain("sending roughly 24,000 tokens");
        // 5,400 rewritten + 2 × 550 outlines = 6,500
        expect(text).toContain("receiving roughly 6,500");
    });

    it("names one model when one does it all", () => {
        expect(
            describePlan(plan, { outline: { promptTokens: 1, model: "m" }, part: { promptTokens: 1, model: "m" } })
        ).toContain(") with m,");
    });
});

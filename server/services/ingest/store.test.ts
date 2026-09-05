import { describe, expect, it } from "vitest";
import { ANALYSIS_TTL_MS, dropAnalysis, getAnalysis, storeAnalysis } from "./store.js";

const chapters = [{ title: "Chapter 1", body: "Prose." }];

describe("analysis store", () => {
    it("returns what was stored", () => {
        const token = storeAnalysis("The Iron Keep", chapters);
        expect(getAnalysis(token)).toMatchObject({ title: "The Iron Keep", chapters });
    });

    it("issues a distinct token per analysis", () => {
        expect(storeAnalysis("A", chapters)).not.toBe(storeAnalysis("B", chapters));
    });

    it("returns null for an unknown token", () => {
        expect(getAnalysis("not-a-token")).toBeNull();
    });

    it("expires an analysis after its TTL", () => {
        const now = Date.now();
        const token = storeAnalysis("Expiring", chapters, now);
        expect(getAnalysis(token, now + ANALYSIS_TTL_MS - 1)).not.toBeNull();
        expect(getAnalysis(token, now + ANALYSIS_TTL_MS)).toBeNull();
    });

    it("forgets an analysis once it has been committed", () => {
        const token = storeAnalysis("Committed", chapters);
        expect(dropAnalysis(token)).toBe(true);
        expect(getAnalysis(token)).toBeNull();
    });

    it("sheds the oldest analyses rather than growing without bound", () => {
        const tokens = Array.from({ length: 25 }, (_, index) => storeAnalysis(`Story ${index}`, chapters));
        expect(getAnalysis(tokens[0])).toBeNull();
        expect(getAnalysis(tokens[tokens.length - 1])).not.toBeNull();
    });
});

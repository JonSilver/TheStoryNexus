import { describe, expect, it } from "vitest";
import { resolveChapterUpdate } from "./chapterUpdate.js";

const now = new Date("2026-01-01T00:00:00Z");

describe("resolveChapterUpdate", () => {
    it("conflicts when expectedRevision mismatches", () => {
        const result = resolveChapterUpdate(5, { content: "x", expectedRevision: 4 }, now);
        expect(result).toEqual({ outcome: "conflict", currentRevision: 5 });
    });

    it("applies and bumps revision on matching expectedRevision content save", () => {
        const result = resolveChapterUpdate(5, { content: "x", expectedRevision: 5 }, now);
        expect(result).toEqual({
            outcome: "apply",
            updates: { content: "x", updatedAt: now, revision: 6 }
        });
    });

    it("applies last-write-wins when expectedRevision absent (legacy clients)", () => {
        const result = resolveChapterUpdate(5, { content: "x" }, now);
        expect(result).toEqual({
            outcome: "apply",
            updates: { content: "x", updatedAt: now, revision: 6 }
        });
    });

    it("does not bump revision for non-content updates", () => {
        const result = resolveChapterUpdate(5, { title: "New title", expectedRevision: 5 }, now);
        expect(result).toEqual({
            outcome: "apply",
            updates: { title: "New title", updatedAt: now }
        });
    });

    it("strips id, createdAt and revision from the applied updates", () => {
        const result = resolveChapterUpdate(0, { id: "hack", createdAt: "then", revision: 99, summary: "s" }, now);
        expect(result).toEqual({
            outcome: "apply",
            updates: { summary: "s", updatedAt: now }
        });
    });
});

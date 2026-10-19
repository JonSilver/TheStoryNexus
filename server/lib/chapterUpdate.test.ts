import { describe, expect, it } from "vitest";
import { resolveChapterUpdate } from "./chapterUpdate.js";

const now = new Date("2026-01-01T00:00:00Z");
const doc = (text: string) =>
    JSON.stringify({
        root: {
            type: "root",
            version: 1,
            children: [{ type: "paragraph", version: 1, children: [{ type: "text", version: 1, text, format: 0 }] }]
        }
    });
const prose = (n: number, word = "harbour") => Array.from({ length: n }, () => word).join(" ");
const current = (content = doc(prose(200)), overrides = {}) => ({
    saveVersion: 5,
    revision: 2,
    content,
    revisionText: null,
    ...overrides
});

describe("resolveChapterUpdate", () => {
    it("conflicts when expectedSaveVersion mismatches", () => {
        expect(resolveChapterUpdate(current(), { content: doc("x"), expectedSaveVersion: 4 }, now)).toEqual({
            outcome: "conflict"
        });
    });

    it("refuses a content save with no expectedSaveVersion — no silent last-write-wins", () => {
        expect(resolveChapterUpdate(current(), { content: doc("x") }, now).outcome).toBe("invalid");
        expect(resolveChapterUpdate(current(), { content: doc("x"), expectedRevision: 2 }, now).outcome).toBe(
            "invalid"
        );
    });

    it("writes nothing when the document is the same, whatever its key order", () => {
        const stored = JSON.stringify({ root: { type: "root", version: 1, children: [] } });
        const reordered = JSON.stringify({ root: { children: [], version: 1, type: "root" } });
        expect(
            resolveChapterUpdate(current(stored), { content: reordered, wordCount: 0, expectedSaveVersion: 5 }, now)
        ).toEqual({ outcome: "unchanged" });
    });

    it("a small edit bumps saveVersion only, and pins the measurement base", () => {
        const result = resolveChapterUpdate(
            current(),
            { content: doc(`${prose(200)} and one more line`), wordCount: 204, expectedSaveVersion: 5 },
            now
        );
        expect(result).toEqual({
            outcome: "apply",
            updates: {
                content: doc(`${prose(200)} and one more line`),
                wordCount: 204,
                updatedAt: now,
                saveVersion: 6,
                revisionText: prose(200)
            }
        });
    });

    it("small edits accumulate against the pinned base until they are significant", () => {
        const base = prose(200);
        const almost = `${base} ${prose(49, "lantern")}`;
        const enough = `${base} ${prose(50, "lantern")}`;
        const pinned = current(doc(almost), { revisionText: base });
        expect(resolveChapterUpdate(pinned, { content: doc(`${almost}!`), expectedSaveVersion: 5 }, now)).toMatchObject(
            { outcome: "apply", updates: { saveVersion: 6, revisionText: base } }
        );
        expect(resolveChapterUpdate(pinned, { content: doc(enough), expectedSaveVersion: 5 }, now)).toMatchObject({
            outcome: "apply",
            updates: { saveVersion: 6, revision: 3, revisionText: enough }
        });
    });

    it("metadata updates touch neither counter", () => {
        expect(resolveChapterUpdate(current(), { title: "New title" }, now)).toEqual({
            outcome: "apply",
            updates: { title: "New title", updatedAt: now }
        });
    });

    it("strips server-managed fields", () => {
        expect(
            resolveChapterUpdate(
                current(),
                { id: "hack", createdAt: "then", revision: 99, saveVersion: 99, revisionText: "x", summary: "s" },
                now
            )
        ).toEqual({ outcome: "apply", updates: { summary: "s", updatedAt: now } });
    });
});

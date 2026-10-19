import { describe, expect, it } from "vitest";
import { resolveChatUpdate } from "./chatUpdate.js";

const now = new Date("2026-01-01T00:00:00Z");

describe("resolveChatUpdate", () => {
    it("replaces messages only on the revision they were built from", () => {
        expect(resolveChatUpdate(3, { messages: [], expectedRevision: 3 }, now)).toEqual({
            outcome: "apply",
            updates: { messages: [], updatedAt: now, revision: 4 },
            guarded: true
        });
        expect(resolveChatUpdate(3, { messages: [], expectedRevision: 2 }, now)).toEqual({ outcome: "conflict" });
    });

    it("refuses a messages write that names no revision — no silent last-write-wins", () => {
        expect(resolveChatUpdate(0, { messages: [] }, now)).toEqual({ outcome: "conflict" });
    });

    it("renames without touching the revision", () => {
        expect(resolveChatUpdate(3, { title: "Plot holes" }, now)).toEqual({
            outcome: "apply",
            updates: { title: "Plot holes", updatedAt: now },
            guarded: false
        });
    });

    it("strips server-managed fields", () => {
        expect(resolveChatUpdate(3, { id: "x", storyId: "y", revision: 99, title: "t" }, now)).toMatchObject({
            updates: { title: "t", updatedAt: now }
        });
    });
});

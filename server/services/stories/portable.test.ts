import { describe, expect, it } from "vitest";
import { type StoryBackup, buildStoryImport, rewriteAssetUrls } from "./portable.js";

const OLD = "old-story";
const NEW = "new-story";
const now = new Date("2026-10-19T12:00:00Z");
const ids = () => {
    const state = { n: 0 };
    return () => `id-${(state.n += 1)}`;
};

const backup: StoryBackup = {
    type: "story",
    story: { id: OLD, title: "Harbour", seriesId: "some-series", language: "British English" },
    chapters: [
        {
            id: "c1",
            storyId: OLD,
            title: "One",
            order: 0,
            content: `{"src":"/api/assets/${OLD}/a.png"}`,
            updatedAt: "2026-09-01T10:00:00.000Z"
        }
    ],
    lorebookEntries: [{ id: "e1", name: "Mara", level: "story", scopeId: OLD, description: "Keeper." }],
    aiChats: [{ id: "ch1", storyId: OLD, title: "Chat", messages: [], createdAt: "2026-09-01T10:00:00.000Z" }],
    notes: [
        {
            id: "n1",
            storyId: OLD,
            title: "Research",
            content: "Tide tables",
            type: "research",
            createdAt: "2026-09-02T10:00:00.000Z",
            updatedAt: "2026-09-03T10:00:00.000Z"
        }
    ],
    actionOverrides: [{ id: "o1", actionId: "continue", storyId: OLD, temperature: 0.6, createdAt: 1_700_000_000_000 }]
};

describe("buildStoryImport", () => {
    const rows = buildStoryImport(backup, NEW, ids(), now);

    it("re-homes every row under the new story", () => {
        expect(rows.story.id).toBe(NEW);
        expect(rows.chapters.every(c => c.storyId === NEW)).toBe(true);
        expect(rows.lorebookEntries.every(e => e.scopeId === NEW && e.level === "story")).toBe(true);
        expect(rows.aiChats.every(c => c.storyId === NEW)).toBe(true);
        expect(rows.notes.every(n => n.storyId === NEW)).toBe(true);
        expect(rows.actionOverrides.every(o => o.storyId === NEW)).toBe(true);
    });

    it("restores notes and per-story overrides — not just chapters and bible", () => {
        expect(rows.notes).toHaveLength(1);
        expect(rows.notes[0].content).toBe("Tide tables");
        expect(rows.actionOverrides).toHaveLength(1);
        expect(rows.actionOverrides[0].temperature).toBe(0.6);
    });

    it("points chapter images at the new story's asset folder", () => {
        expect(rows.chapters[0].content).toContain(`/api/assets/${NEW}/a.png`);
        expect(rows.chapters[0].content).not.toContain(OLD);
    });

    it("turns JSON timestamps back into Dates and drops the series link", () => {
        expect(rows.chapters[0].updatedAt).toBeInstanceOf(Date);
        expect(rows.notes[0].updatedAt).toEqual(new Date("2026-09-03T10:00:00.000Z"));
        expect(rows.actionOverrides[0].createdAt).toBeInstanceOf(Date);
        expect(rows.story.seriesId).toBeNull();
    });

    it("gives every row a fresh id", () => {
        const all = [
            ...rows.chapters,
            ...rows.lorebookEntries,
            ...rows.aiChats,
            ...rows.notes,
            ...rows.actionOverrides
        ].map(r => r.id);
        expect(new Set(all).size).toBe(all.length);
        expect(all).not.toContain("c1");
    });
});

describe("rewriteAssetUrls", () => {
    it("rewrites only this story's asset paths", () => {
        const content = "/api/assets/old-story/x.png and /api/assets/other/y.png";
        expect(rewriteAssetUrls(content, OLD, NEW)).toBe("/api/assets/new-story/x.png and /api/assets/other/y.png");
    });
});

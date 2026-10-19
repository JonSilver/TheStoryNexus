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

describe("untrusted backup fields", () => {
    const hostile: StoryBackup = {
        type: "story",
        story: { id: OLD, title: "Trap", isDemo: true, seriesId: "victim-series", createdAt: "1970-01-01" },
        chapters: [{ id: "c1", storyId: "someone-else", title: "One", order: 0, content: "", isDemo: true }],
        lorebookEntries: [{ id: "e1", name: "X", level: "global", scopeId: null, description: "d", isDemo: true }],
        notes: [{ id: "n1", storyId: "someone-else", title: "N", content: "c", type: "idea", isDemo: true }]
    };
    const rows = buildStoryImport(hostile, NEW, ids(), now);

    it("never carries internal flags across (isDemo would make restored work deletable as demo content)", () => {
        expect("isDemo" in rows.story).toBe(false);
        expect(rows.chapters.some(c => "isDemo" in c)).toBe(false);
        expect(rows.lorebookEntries.some(e => "isDemo" in e)).toBe(false);
        expect(rows.notes.some(n => "isDemo" in n)).toBe(false);
    });

    it("cannot escalate a story entry to global or attach to another story or series", () => {
        expect(rows.lorebookEntries[0].level).toBe("story");
        expect(rows.lorebookEntries[0].scopeId).toBe(NEW);
        expect(rows.chapters[0].storyId).toBe(NEW);
        expect(rows.story.seriesId).toBeNull();
    });
});

describe("buildSeriesImport", () => {
    it("re-homes series entries and member stories under fresh ids, linked to the new series", async () => {
        const { buildSeriesImport } = await import("./portable.js");
        const rows = buildSeriesImport(
            {
                type: "series",
                series: { id: "s-old", name: "Saga", isDemo: true },
                lorebookEntries: [{ name: "The Realm", description: "World.", category: "location" }],
                stories: [backup]
            },
            "s-new",
            ids(),
            now
        );
        expect(rows.series.name).toBe("Saga (Imported)");
        expect("isDemo" in rows.series).toBe(false);
        expect(rows.lorebookEntries[0]).toMatchObject({ level: "series", scopeId: "s-new" });
        expect(rows.stories).toHaveLength(1);
        expect(rows.stories[0].rows.story.seriesId).toBe("s-new");
        expect(rows.stories[0].rows.story.title).toBe("Harbour");
        expect(rows.stories[0].rows.notes).toHaveLength(1);
    });
});

describe("imported revision counters", () => {
    const chapterWith = (fields: Record<string, unknown>) =>
        buildStoryImport({ ...backup, chapters: [{ ...backup.chapters?.[0], ...fields }] }, NEW, ids(), now)
            .chapters[0];

    it("refuses counters that aren't safe non-negative integers", () => {
        expect(chapterWith({ revision: 1e100 }).revision).toBe(0);
        expect(chapterWith({ revision: -3 }).revision).toBe(0);
        expect(chapterWith({ revision: 2.5 }).revision).toBe(0);
    });

    it("never marks a missing or future summary as fresh", () => {
        expect(chapterWith({ revision: 4, summary: null, summarySourceRevision: 4 }).summarySourceRevision).toBeNull();
        expect(chapterWith({ revision: 4, summary: "S", summarySourceRevision: 9 }).summarySourceRevision).toBeNull();
        expect(chapterWith({ revision: 4, summary: "S", summarySourceRevision: 4 }).summarySourceRevision).toBe(4);
    });
});

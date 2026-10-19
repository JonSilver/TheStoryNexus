import { describe, expect, it } from "vitest";
import { type MatchableEntry, matchEntries, truncateByRank } from "./matching.js";

const entry = (overrides: Partial<MatchableEntry> & { id: string }): MatchableEntry => ({
    name: overrides.id,
    tags: [],
    level: "story",
    ...overrides
});

describe("matchEntries", () => {
    it("matches on word boundaries only", () => {
        const entries = [entry({ id: "ash", name: "Ash" })];
        expect(matchEntries("Ash walked in, ashamed of the cash.", entries)).toHaveLength(1);
        expect(matchEntries("Ash walked in.", entries)[0].occurrences).toBe(1);
        expect(matchEntries("ashamed of the cash", entries)).toHaveLength(0);
    });

    it("is case-insensitive and Unicode-normalised", () => {
        const entries = [entry({ id: "zoe", name: "Zoë" })];
        expect(matchEntries("ZOË stood up. zoë sat down.", entries)[0].occurrences).toBe(2);
    });

    it("matches multi-word aliases as phrases", () => {
        const entries = [entry({ id: "keep", name: "Iron Keep" })];
        expect(matchEntries("They rode to the Iron Keep at dawn.", entries)).toHaveLength(1);
        expect(matchEntries("The iron was kept in the keep.", entries)).toHaveLength(0);
    });

    it("tolerates trailing possessives", () => {
        const entries = [entry({ id: "mara", name: "Mara" })];
        expect(matchEntries("Mara's sword gleamed. Mara’s eyes.", entries)[0].occurrences).toBe(2);
    });

    it("matches via tags as well as name", () => {
        const entries = [entry({ id: "mara", name: "Mara", tags: ["the Captain"] })];
        const matches = matchEntries("The Captain gave the order.", entries);
        expect(matches).toHaveLength(1);
        expect(matches[0].matchedAliases).toEqual(["the captain"]);
    });

    it("excludes disabled entries", () => {
        const entries = [entry({ id: "mara", name: "Mara", isDisabled: true })];
        expect(matchEntries("Mara spoke.", entries)).toHaveLength(0);
    });

    it("does not match punctuation-adjacent false positives but does match adjacent punctuation", () => {
        const entries = [entry({ id: "ash", name: "Ash" })];
        expect(matchEntries('"Ash!" she cried. (Ash, again.)', entries)[0].occurrences).toBe(2);
    });

    it("ranks story > series > global, then occurrences, then name", () => {
        const entries = [
            entry({ id: "g", name: "Blade", level: "global" }),
            entry({ id: "s", name: "Blade", level: "story" }),
            entry({ id: "se", name: "Blade", level: "series" })
        ];
        const order = matchEntries("The Blade fell.", entries).map(m => m.entry.id);
        expect(order).toEqual(["s", "se", "g"]);
    });

    it("returns nothing for empty text", () => {
        expect(matchEntries("   ", [entry({ id: "a", name: "A" })])).toHaveLength(0);
    });

    it("ignores empty aliases from blank tags", () => {
        const entries = [entry({ id: "m", name: "Mara", tags: ["", "  "] })];
        expect(matchEntries("Mara left.", entries)[0].matchedAliases).toEqual(["mara"]);
    });
});

describe("truncateByRank", () => {
    it("keeps matches in rank order until the budget runs out", () => {
        const entries = [
            entry({ id: "a", name: "Alpha" }),
            entry({ id: "b", name: "Beta" }),
            entry({ id: "c", name: "Gamma" })
        ];
        const matches = matchEntries("Alpha Beta Gamma", entries);
        const kept = truncateByRank(matches, () => 10, 25);
        expect(kept).toHaveLength(2);
    });
});

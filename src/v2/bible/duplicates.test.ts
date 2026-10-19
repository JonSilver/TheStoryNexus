import { describe, expect, it } from "vitest";
import type { LorebookEntry } from "@/types/story";
import { entryMatches, findDuplicatePairs } from "./duplicates";

const entry = (name: string, category: string, tags: string[] = [], description = ""): LorebookEntry =>
    ({ id: name, name, category, tags, description, level: "story" }) as LorebookEntry;

describe("findDuplicatePairs", () => {
    it("pairs an entry whose name contains the other's on a word boundary", () => {
        const pairs = findDuplicatePairs([entry("Colonel Brandon", "character"), entry("Brandon", "character")]);
        expect(pairs).toHaveLength(1);
        expect(pairs[0].reason).toBe("name contains the other");
    });

    it("does not pair on substring without word boundary", () => {
        expect(findDuplicatePairs([entry("Marianne", "character"), entry("Anne", "character")])).toHaveLength(0);
    });

    it("pairs entries sharing an alias", () => {
        const pairs = findDuplicatePairs([
            entry("Mrs Jennings", "character", ["the meddler"]),
            entry("Jennings the elder", "character", ["the meddler"])
        ]);
        expect(pairs).toHaveLength(1);
        expect(pairs[0].reason).toContain("shared alias");
    });

    it("never pairs across categories", () => {
        expect(findDuplicatePairs([entry("Delaford", "location"), entry("Delaford", "character")])).toHaveLength(0);
    });
});

describe("entryMatches", () => {
    it("matches name, tags and description case-insensitively", () => {
        const e = entry("Colonel Brandon", "character", ["the colonel"], "Owns Delaford.");
        expect(entryMatches(e, "brandon")).toBe(true);
        expect(entryMatches(e, "THE COLONEL")).toBe(true);
        expect(entryMatches(e, "delaford")).toBe(true);
        expect(entryMatches(e, "willoughby")).toBe(false);
        expect(entryMatches(e, "")).toBe(true);
    });
});
